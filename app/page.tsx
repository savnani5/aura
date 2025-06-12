'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CreateMeetingPopup } from './components/CreateMeetingPopup';
import { MeetingRoomCard } from './components/MeetingRoomCard';
import { OneOffMeetingCard } from './components/OneOffMeetingCard';
import { AllMeetingRoomsView } from './components/AllMeetingRoomsView';
import { AllRecentMeetingsView } from './components/AllRecentMeetingsView';
import styles from '@/styles/HomePage.module.css';

// TypeScript interfaces for API data
interface MeetingRoom {
  id: string;
  title: string;
  type: string;
  description: string;
  participantCount: number;
  lastActivity: Date;
  isActive: boolean;
  recentMeetings: number;
}

interface OneOffMeeting {
  id: string;
  roomName: string;
  title?: string;
  type: string;
  startedAt: Date;
  endedAt?: Date;
  participantCount: number;
  duration?: number;
  hasTranscripts: boolean;
  hasSummary: boolean;
}

export default function HomePage() {
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showAllMeetings, setShowAllMeetings] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoom[]>([]);
  const [oneOffMeetings, setOneOffMeetings] = useState<OneOffMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data from API endpoints
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch meeting rooms and one-off meetings in parallel
      const [roomsResponse, instantMeetingsResponse] = await Promise.all([
        fetch('/api/meetings'), // Default: meeting rooms
        fetch('/api/meetings?type=instant') // One-off meetings
      ]);
      
      // Handle meeting rooms
      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json();
        if (roomsData.success) {
          // Convert API data to expected format
          const formattedRooms: MeetingRoom[] = roomsData.data.map((room: any) => ({
            id: room.id,
            title: room.title,
            type: room.type,
            description: room.description || 'No description available',
            participantCount: room.participantCount,
            lastActivity: new Date(room.lastActivity || room.updatedAt || Date.now()),
            isActive: room.isActive,
            recentMeetings: room.recentMeetings || 0
          }));
          setMeetingRooms(formattedRooms);
        } else {
          console.error('Failed to fetch meeting rooms:', roomsData.error);
          setMeetingRooms([]);
        }
      } else {
        throw new Error('Failed to fetch meeting rooms');
      }

      // Handle one-off meetings
      if (instantMeetingsResponse.ok) {
        const instantData = await instantMeetingsResponse.json();
        if (instantData.success) {
          // Data is already in the correct OneOffMeeting format, but dates need conversion
          const formattedInstantMeetings: OneOffMeeting[] = instantData.data.map((meeting: any) => ({
            id: meeting.id,
            roomName: meeting.roomName,
            title: meeting.title,
            type: meeting.type,
            startedAt: new Date(meeting.startedAt), // Convert string to Date
            endedAt: meeting.endedAt ? new Date(meeting.endedAt) : undefined, // Convert if exists
            participantCount: meeting.participantCount,
            duration: meeting.duration,
            hasTranscripts: meeting.hasTranscripts,
            hasSummary: meeting.hasSummary
          }));
          setOneOffMeetings(formattedInstantMeetings);
        } else {
          console.error('Failed to fetch instant meetings:', instantData.error);
          setOneOffMeetings([]);
        }
      } else {
        console.warn('Failed to fetch instant meetings');
        setOneOffMeetings([]);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
      // Set empty arrays on error to prevent crashes
      setMeetingRooms([]);
      setOneOffMeetings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data when a new meeting is created (called manually if needed)
  const handleMeetingCreated = () => {
    fetchData(); // Just refresh all data
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sort meetings by most recent and limit to 3 for landing page
  const sortedOneOffMeetings = [...oneOffMeetings].sort((a, b) => {
    const dateA = a.startedAt || new Date(0);
    const dateB = b.startedAt || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const meetingRoomsPreview = meetingRooms.slice(0, 3);
  const recentMeetingsPreview = sortedOneOffMeetings.slice(0, 3);
  const hasMoreRooms = meetingRooms.length > 3;
  const hasMoreMeetings = oneOffMeetings.length > 3;

  const handleViewAllRooms = () => {
    setShowAllRooms(true);
  };

  const handleViewAllMeetings = () => {
    setShowAllMeetings(true);
  };

  // If showing all rooms or meetings, render the respective component
  if (showAllRooms) {
    return (
      <AllMeetingRoomsView 
        meetingRooms={meetingRooms}
        onBack={() => setShowAllRooms(false)}
        onRefresh={fetchData}
        isLoading={isLoading}
      />
    );
  }

  if (showAllMeetings) {
    return (
      <AllRecentMeetingsView 
        meetings={oneOffMeetings}
        onBack={() => setShowAllMeetings(false)}
        onRefresh={fetchData}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <Image 
              src="/images/ohm-icon.svg" 
              alt="Ohm" 
              width={40} 
              height={40}
            />
            <h1>Ohm</h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              AI-First Video
              <span className={styles.gradientText}> Conferencing</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Smart meetings with real-time transcription, personalized notes, 
              and AI-powered insights. Transform how your team collaborates.
            </p>
            <div className={styles.heroActions}>
              <button 
                onClick={() => setShowCreatePopup(true)}
                className={styles.primaryButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                </svg>
                Start Meeting
              </button>
              <button className={styles.secondaryButton}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                </svg>
                Watch Demo
              </button>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.floatingCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className={styles.cardTitle}>Live Meeting</span>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.mockTranscript}>
                  <div className={styles.transcriptLine}>
                    <span className={styles.speaker}>Alex:</span>
                    <span>Let&apos;s discuss the Q4 roadmap...</span>
                  </div>
                  <div className={styles.transcriptLine}>
                    <span className={styles.speaker}>Sarah:</span>
                    <span>I think we should prioritize the AI features</span>
                  </div>
                </div>
                <div className={styles.aiSummary}>
                  <div className={styles.aiIcon}>🤖</div>
                  <span>AI generating summary...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.mainContent}>
          
          {/* Meeting Rooms Section */}
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderContent}>
                <div className={styles.sectionTitleGroup}>
                  <div className={styles.sectionIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2"/>
                      <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className={styles.sectionTitle}>Your Meeting Rooms</h2>
                    <p className={styles.sectionDescription}>
                      Persistent spaces for your team meetings and collaboration
                    </p>
                  </div>
                </div>
                {hasMoreRooms && (
                  <button 
                    onClick={handleViewAllRooms}
                    className={styles.viewAllButton}
                  >
                    <span>View All ({meetingRooms.length})</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading meeting rooms...</p>
              </div>
            ) : meetingRoomsPreview.length > 0 ? (
              <div className={styles.meetingRoomsGrid}>
                {meetingRoomsPreview.map((room) => (
                  <MeetingRoomCard key={room.id} room={room} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2"/>
                    <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <h3 className={styles.emptyStateTitle}>No meeting rooms yet</h3>
                <p className={styles.emptyStateDescription}>
                  Create your first meeting room to get started with persistent team collaboration
                </p>
                <button 
                  onClick={() => setShowCreatePopup(true)}
                  className={styles.emptyStateButton}
                >
                  Create Meeting Room
                </button>
              </div>
            )}
          </section>

          {/* Instant Meetings Section */}
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderContent}>
                <div className={styles.sectionTitleGroup}>
                  <div className={styles.sectionIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className={styles.sectionTitle}>Instant Meetings</h2>
                    <p className={styles.sectionDescription}>
                      Your recent one-off meetings and instant calls
                    </p>
                  </div>
                </div>
                {hasMoreMeetings && (
                  <button 
                    onClick={handleViewAllMeetings}
                    className={styles.viewAllButton}
                  >
                    <span>View All ({oneOffMeetings.length})</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading instant meetings...</p>
              </div>
            ) : recentMeetingsPreview.length > 0 ? (
              <div className={styles.oneOffMeetingsGrid}>
                {recentMeetingsPreview.map((meeting) => (
                  <OneOffMeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                  </svg>
                </div>
                <h3 className={styles.emptyStateTitle}>No instant meetings</h3>
                <p className={styles.emptyStateDescription}>
                  Start an instant meeting to see your recent calls here
                </p>
                <button 
                  onClick={() => setShowCreatePopup(true)}
                  className={styles.emptyStateButton}
                >
                  Start Instant Meeting
                </button>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Create Meeting Popup */}
      <CreateMeetingPopup 
        isOpen={showCreatePopup}
        onClose={() => setShowCreatePopup(false)}
      />
    </div>
  );
}
