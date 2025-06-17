'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/client-utils';
import styles from '@/styles/InstantMeetingPopup.module.css';

interface InstantMeetingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated?: () => void;
}

interface InstantMeetingForm {
  name: string;
}

export function InstantMeetingPopup({ isOpen, onClose, onMeetingCreated }: InstantMeetingPopupProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const [form, setForm] = useState<InstantMeetingForm>({
    name: ''
  });

  if (!isOpen) return null;

  const handleInstantMeeting = async () => {
    setIsLoading(true);
    
    try {
      const roomId = generateRoomId();
      const meetingName = form.name.trim() || 'Instant Meeting';
      
      // Create one-off meeting record in database
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomId,
          title: meetingName,
          type: 'Instant Meeting',
          isRecurring: false,
          participantName: 'Host'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('One-off meeting created:', data);
        onMeetingCreated?.();
      } else {
        console.warn('Failed to create meeting record, proceeding anyway');
      }

      // Navigate to LiveKit room
      router.push(`/rooms/${roomId}?name=${encodeURIComponent(meetingName)}`);
      
    } catch (error) {
      console.error('Error creating instant meeting:', error);
      // Fallback: navigate without database record
      const roomId = generateRoomId();
      const meetingName = form.name.trim();
      
      onMeetingCreated?.();
      
      if (meetingName) {
        router.push(`/rooms/${roomId}?name=${encodeURIComponent(meetingName)}`);
      } else {
        router.push(`/rooms/${roomId}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Start Instant Meeting</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.instantTab}>
            <div className={styles.instantIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polygon points="10,8 16,12 10,16" fill="currentColor"/>
              </svg>
            </div>
            <h3 className={styles.instantTitle}>Start Instant Meeting</h3>
            <p className={styles.instantDescription}>
              Create a quick video conference room that you can share with others
            </p>
            
            <div className={styles.instantForm}>
              <div className={styles.formGroup}>
                <label htmlFor="meetingName" className={styles.label}>
                  Meeting Name (Optional)
                </label>
                <input
                  id="meetingName"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Quick Team Sync"
                  className={styles.input}
                  autoComplete="off"
                />
              </div>
            </div>
            
            <button 
              onClick={handleInstantMeeting}
              disabled={isLoading}
              className={styles.primaryButton}
            >
              {isLoading ? 'Starting...' : 'Start Meeting Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 