'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/MeetingPrep.module.css';

interface MeetingPrepProps {
  roomName: string;
}

export function MeetingPrep({ roomName }: MeetingPrepProps) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved notes on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(`meeting-notes-${roomName}`);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [roomName]);

  // Auto-save notes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes.trim()) {
        localStorage.setItem(`meeting-notes-${roomName}`, notes);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, roomName]);

  const handleStartMeeting = async () => {
    setIsLoading(true);
    
    try {
      // Save notes before starting meeting
      if (notes.trim()) {
        localStorage.setItem(`meeting-notes-${roomName}`, notes);
      }
      
      // Navigate to the live video meeting
      router.push(`/rooms/${roomName}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
      setIsLoading(false);
    }
  };

  const clearNotes = () => {
    setNotes('');
    localStorage.removeItem(`meeting-notes-${roomName}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Meeting Prep</h2>
          <p className={styles.subtitle}>Jot down your thoughts and agenda before the meeting</p>
        </div>
      </div>

      <div className={styles.notesSection}>
        <div className={styles.notesHeader}>
          {/* <label className={styles.notesLabel}>Pre-meeting Notes</label> */}
          {notes.trim() && (
            <button onClick={clearNotes} className={styles.clearButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Clear
            </button>
          )}
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
          <div className={styles.characterCount}>
            {notes.length} characters
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          onClick={handleStartMeeting}
          disabled={isLoading}
          className={styles.startMeetingButton}
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
              Start Meeting
            </>
          )}
        </button>
      </div>
    </div>
  );
} 