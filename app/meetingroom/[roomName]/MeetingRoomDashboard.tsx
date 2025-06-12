'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MeetingHistoryPanel } from './components/MeetingHistoryPanel';
import { TaskBoard } from './components/TaskBoard';
import RoomChat from './components/RoomChat';
import { MeetingPrep } from './components/MeetingPrep';
import styles from '@/styles/MeetingRoomDashboard.module.css';

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

interface Participant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  isHost?: boolean;
}

interface MeetingRoomDashboardProps {
  roomName: string;
}

export function MeetingRoomDashboard({ roomName }: MeetingRoomDashboardProps) {
  const router = useRouter();
  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'prep' | 'history' | 'tasks'>('prep');

  // Mock current user for demo purposes
  const currentUser = 'Demo User';

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const onlineParticipants = participants.filter(p => p.isOnline);
  const displayParticipants = onlineParticipants.slice(0, 4);
  const remainingCount = onlineParticipants.length - displayParticipants.length;

  // Fetch room data and participants
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch room data
        const roomResponse = await fetch(`/api/meetings/${roomName}`);
        if (!roomResponse.ok) {
          throw new Error('Room not found');
        }
        const roomData = await roomResponse.json();
        
        if (!roomData.success) {
          throw new Error(roomData.error);
        }
        
        setRoom(roomData.data);
        
        // Fetch participants data
        const participantsResponse = await fetch(`/api/participants/${roomName}`);
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          if (participantsData.success) {
            setParticipants(participantsData.data);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomName]);

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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
          
          {/* Participant Blobs */}
          <div className={styles.participantBlobs}>
            {displayParticipants.map((participant) => (
              <div
                key={participant.id}
                className={`${styles.participantBlob} ${participant.isHost ? styles.hostBlob : ''}`}
                title={`${participant.name}${participant.isHost ? ' (Host)' : ''}`}
              >
                {getInitials(participant.name)}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className={styles.participantCount} title={`+${remainingCount} more participants`}>
                +{remainingCount}
              </div>
            )}
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
                onClick={() => setActivePanel('prep')}
                className={`${styles.navButton} ${activePanel === 'prep' ? styles.navButtonActive : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Meeting Prep
              </button>
              
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
            </nav>
            
            {/* Compact Participants below navigation */}
          </aside>

          {/* Right Panel - Content */}
          <div className={styles.content}>
            {activePanel === 'prep' && (
              <div className={styles.meetingPrepLayout}>
                <div className={styles.chatSection}>
                  <RoomChat roomName={roomName} currentUser={currentUser} />
                </div>
                <div className={styles.prepSection}>
                  <MeetingPrep roomName={roomName} />
                </div>
              </div>
            )}
            {activePanel === 'tasks' && <TaskBoard roomName={roomName} />}
            {activePanel === 'history' && <MeetingHistoryPanel roomName={roomName} />}
          </div>
        </div>
      </main>
    </div>
  );
} 