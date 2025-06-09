'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MeetingHistoryPanel } from './components/MeetingHistoryPanel';
import { TaskBoard } from './components/TaskBoard';
import { ParticipantsPanel } from './components/ParticipantsPanel';
import RoomChat from '../../components/RoomChat';
import styles from './MeetingRoomDashboard.module.css';

interface MeetingRoom {
  id: string;
  roomName: string;
  title: string;
  type: string;
  description?: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MeetingRoomDashboardProps {
  roomName: string;
}

export function MeetingRoomDashboard({ roomName }: MeetingRoomDashboardProps) {
  const router = useRouter();
  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'history' | 'tasks' | 'participants' | 'chat'>('tasks');

  // Mock current user for demo purposes
  const currentUser = 'Demo User';

  // Fetch room data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`/api/meetings/${roomName}`);
        if (!response.ok) {
          throw new Error('Room not found');
        }
        const roomData = await response.json();
        setRoom(roomData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomName]);

  const handleJoinMeeting = () => {
    // Navigate to the live video meeting
    router.push(`/rooms/${roomName}`);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h2>Room Not Found</h2>
          <p>{error || 'The meeting room you\'re looking for doesn\'t exist.'}</p>
          <button onClick={handleBackToHome} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.roomInfo}>
            <button onClick={handleBackToHome} className={styles.backButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={styles.roomDetails}>
              <h1 className={styles.roomTitle}>{room.title}</h1>
              <div className={styles.roomMeta}>
                <span className={styles.roomType}>{room.type}</span>
                <span className={styles.roomName}>#{roomName}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            <button onClick={handleJoinMeeting} className={styles.joinButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Join Meeting
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.mainContent}>
          {/* Left Panel - Navigation */}
          <aside className={styles.sidebar}>
            <nav className={styles.navigation}>
              <button
                onClick={() => setActivePanel('tasks')}
                className={`${styles.navButton} ${activePanel === 'tasks' ? styles.navButtonActive : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 21c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 21c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Tasks
              </button>
              
              <button
                onClick={() => setActivePanel('history')}
                className={`${styles.navButton} ${activePanel === 'history' ? styles.navButtonActive : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
                </svg>
                History
              </button>
              
              <button
                onClick={() => setActivePanel('participants')}
                className={`${styles.navButton} ${activePanel === 'participants' ? styles.navButtonActive : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Participants
              </button>
              
              <button
                onClick={() => setActivePanel('chat')}
                className={`${styles.navButton} ${activePanel === 'chat' ? styles.navButtonActive : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Ask Ohm
              </button>
            </nav>
          </aside>

          {/* Right Panel - Content */}
          <div className={styles.content}>
            {activePanel === 'tasks' && <TaskBoard roomName={roomName} />}
            {activePanel === 'history' && <MeetingHistoryPanel roomName={roomName} />}
            {activePanel === 'participants' && <ParticipantsPanel roomName={roomName} />}
            {activePanel === 'chat' && <RoomChat roomName={roomName} currentUser={currentUser} />}
          </div>
        </div>
      </main>
    </div>
  );
} 