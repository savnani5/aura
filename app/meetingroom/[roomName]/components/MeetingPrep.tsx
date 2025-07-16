'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import styles from '@/styles/MeetingPrep.module.css';
import { MeetingStorageUtils } from '@/lib/state';

interface MeetingPrepProps {
  roomName: string;
}

export function MeetingPrep({ roomName }: MeetingPrepProps) {
  const router = useRouter();
  const { user } = useUser();
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create user-specific storage key
  const getNotesStorageKey = () => {
    const userId = user?.id || 'anonymous';
    return `meeting-prep-notes-${roomName}-${userId}`;
  };

  // Load saved notes on component mount from Zustand store (replaces localStorage)
  useEffect(() => {
    if (user) {
      const savedNotes = MeetingStorageUtils.getUserMeetingNotes(`prep-${roomName}`, user.id);
      if (savedNotes) {
        setNotes(savedNotes);
      }
    }
  }, [user, roomName]);

  // Auto-save notes
  useEffect(() => {
    if (!user) return;
    
    const timeoutId = setTimeout(() => {
      // Save notes to Zustand store (replaces localStorage)
      if (notes.trim()) {
        MeetingStorageUtils.setUserMeetingNotes(`prep-${roomName}`, user.id, notes);
      } else {
        MeetingStorageUtils.clearUserMeetingNotes(`prep-${roomName}`, user.id);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, user, roomName]);

  const handleStartMeeting = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setIsLoading(true);
    
    try {
      // Save prep notes and transfer to live meeting notes format
      if (notes.trim()) {
        MeetingStorageUtils.setUserMeetingNotes(`prep-${roomName}`, user.id, notes);
        
        // Transfer notes to live meeting format (what MeetingAssistant expects)
        MeetingStorageUtils.setUserMeetingNotes(roomName, user.id, notes);
      }
      
      // Create meeting record in database
      const response = await fetch('/api/meetings/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomName,
          roomId: roomName, // Use roomName as roomId to find the meeting room
          participantName: user.fullName || user.firstName || 'Host'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Meeting started:', data);
        
        // Store meetingId in Zustand store (replaces localStorage)
        if (data.success && data.data?.meetingId) {
          MeetingStorageUtils.setMeetingId(roomName, data.data.meetingId);
        }
      } else {
        console.warn('Failed to create meeting record, proceeding anyway');
      }
      
      // Navigate to the live video meeting
      router.push(`/rooms/${roomName}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
      // Still navigate to meeting even if database record creation fails
      router.push(`/rooms/${roomName}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearNotes = () => {
    if (confirm('Are you sure you want to clear all notes?')) {
      setNotes('');
      if (user) {
        MeetingStorageUtils.clearUserMeetingNotes(`prep-${roomName}`, user.id);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Your Notepad</h2>
          {/* <p className={styles.subtitle}></p> */}
        </div>
        <div className={styles.headerRight}>
          <button
            onClick={handleStartMeeting}
            disabled={isLoading || !user}
            className={styles.joinMeetingButton}
          >
            {isLoading ? (
              <>
                <div className={styles.spinner} />
                Starting...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Join Meeting
              </>
            )}
          </button>
        </div>
      </div>

      <div className={styles.notesSection}>
        <div className={styles.notesHeader}>
          <div className={styles.transferNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Your notes will transfer to the live meeting
          </div>
        </div>
        
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`What do you want to discuss in this meeting?

• Key topics to cover
• Questions to ask
• Goals and objectives
• Important decisions to make`}
          className={styles.notesTextarea}
        />
        
        <div className={styles.notesFooter}>
          <div className={styles.notesInfo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="l9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Auto-saved locally
          </div>
        </div>
      </div>
    </div>
  );
} 