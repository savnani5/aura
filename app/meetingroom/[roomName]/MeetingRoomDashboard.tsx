'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { MeetingHistoryPanel } from './components/MeetingHistoryPanel';
import { TaskBoard } from './components/TaskBoard';
import RoomChat from './components/RoomChat';
import { MeetingPrep } from './components/MeetingPrep';
import { RoomSettings } from './components/RoomSettings';
import { MeetingModal } from './components/MeetingModal';
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
  participants: Array<{
    _id?: string;
    userId?: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    linkedAt?: string;
  }>;
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
  const { user, isLoaded } = useUser();
  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'prep' | 'history' | 'tasks' | 'settings'>('prep');
  const [isCurrentUserHost, setIsCurrentUserHost] = useState(false);
  
  // Modal state for manually opening meeting details
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const onlineParticipants = participants.filter(p => p.isOnline);
  const displayParticipants = onlineParticipants.slice(0, 4);
  const remainingCount = onlineParticipants.length - displayParticipants.length;

  // Function to refresh room data after settings update
  const refreshRoomData = async () => {
    try {
      const roomResponse = await fetch(`/api/meetings/${roomName}`);
      if (roomResponse.ok) {
        const roomData = await roomResponse.json();
        if (roomData.success) {
          setRoom(roomData.data);
          
          // Update participants and check if current user is host
          if (roomData.data.participants && user?.emailAddresses?.[0]?.emailAddress) {
            const currentUserEmail = user.emailAddresses[0].emailAddress;
            const transformedParticipants: Participant[] = roomData.data.participants.map((p: any, index: number) => ({
              id: p._id || `participant-${index}`,
              name: p.name,
              email: p.email,
              avatar: p.avatar,
              isOnline: true,
              isHost: p.role === 'host'
            }));
            setParticipants(transformedParticipants);
            
            // Check if current user is host by comparing email addresses
            const currentUserParticipant = roomData.data.participants.find(
              (p: any) => p.email === currentUserEmail && p.role === 'host'
            );
            setIsCurrentUserHost(!!currentUserParticipant);
          }
        }
      }
    } catch (err) {
      console.error('Error refreshing room data:', err);
    }
  };

  // Fetch room data and participants
  useEffect(() => {
    if (!isLoaded || !user) return;

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
        
        // Transform room participants to match our interface and check if current user is host
        if (roomData.data.participants && user?.emailAddresses?.[0]?.emailAddress) {
          const currentUserEmail = user.emailAddresses[0].emailAddress;
          const transformedParticipants: Participant[] = roomData.data.participants.map((p: any, index: number) => ({
            id: p._id || `participant-${index}`,
            name: p.name,
            email: p.email,
            avatar: p.avatar,
            isOnline: true, // Assume all participants are online for demo
            isHost: p.role === 'host'
          }));
          setParticipants(transformedParticipants);
          
          // Check if current user is host by comparing email addresses
          const currentUserParticipant = roomData.data.participants.find(
            (p: any) => p.email === currentUserEmail && p.role === 'host'
          );
          setIsCurrentUserHost(!!currentUserParticipant);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomName, user, isLoaded]);

  const handleBackToHome = () => {
    router.push('/');
  };

  // Show loading while Clerk is loading
  if (!isLoaded || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (!user) {
    router.push('/');
    return null;
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
                {isCurrentUserHost && (
                  <span className={styles.hostBadge}>Host</span>
                )}
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

              {/* Only show Settings tab if current user is host */}
              {isCurrentUserHost && (
                <button
                  onClick={() => setActivePanel('settings')}
                  className={`${styles.navButton} ${activePanel === 'settings' ? styles.navButtonActive : ''}`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.07a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Settings
                </button>
              )}
            </nav>
            
            {/* Compact Participants below navigation */}
          </aside>

          {/* Right Panel - Content */}
          <div className={styles.content}>
            {activePanel === 'prep' && (
              <div className={styles.meetingPrepLayout}>
                <div className={styles.chatSection}>
                  <RoomChat 
                    roomName={roomName} 
                    currentUser={user.fullName || user.firstName || 'Anonymous'} 
                  />
                </div>
                <div className={styles.prepSection}>
                  <MeetingPrep roomName={roomName} />
                </div>
              </div>
            )}
            {activePanel === 'tasks' && <TaskBoard roomName={roomName} />}
            {activePanel === 'history' && (
              <MeetingHistoryPanel 
                roomName={roomName} 
                onMeetingSelect={setSelectedMeetingId}
              />
            )}
            {activePanel === 'settings' && room && isCurrentUserHost && (
              <RoomSettings 
                room={room} 
                roomName={roomName}
                onRoomUpdated={refreshRoomData}
                onRoomDeleted={handleBackToHome}
              />
            )}
          </div>
        </div>
      </main>
      
      {/* Meeting Modal - auto-opens after meeting ends */}
      {selectedMeetingId && (
        <MeetingModal
          meetingId={selectedMeetingId}
          isOpen={!!selectedMeetingId}
          onClose={() => setSelectedMeetingId(null)}
        />
      )}
    </div>
  );
} 