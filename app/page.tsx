'use client';

import React, { useState, useEffect } from 'react';
import { CreateMeetingPopup } from './components/CreateMeetingPopup';
import { MeetingRoomCard } from './components/MeetingRoomCard';
import { OneOffMeetingCard } from './components/OneOffMeetingCard';
import { AllMeetingRoomsView } from './components/AllMeetingRoomsView';
import { AllRecentMeetingsView } from './components/AllRecentMeetingsView';
import styles from '@/styles/HomePage.module.css';

// Mock data for meeting rooms - will be replaced with API calls
const mockMeetingRooms = [
  {
    id: 'weekly-standup-123',
    title: 'Weekly Team Standup',
    type: 'Daily Standup',
    description: 'Our regular team sync to discuss progress and blockers',
    participantCount: 5,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    isActive: false,
    recentMeetings: 12
  },
  {
    id: 'client-review-456',
    title: 'Client Project Review',
    type: 'Client Review',
    description: 'Monthly review with the client team',
    participantCount: 8,
    lastActivity: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    isActive: true,
    recentMeetings: 3
  },
  {
    id: 'design-sync-789',
    title: 'Design Team Sync',
    type: 'Design Review',
    description: 'Weekly design review and feedback session',
    participantCount: 4,
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    isActive: false,
    recentMeetings: 8
  },
  {
    id: 'sprint-planning-101',
    title: 'Sprint Planning',
    type: 'Project Planning',
    description: 'Bi-weekly sprint planning and estimation',
    participantCount: 6,
    lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    isActive: false,
    recentMeetings: 6
  },
  {
    id: 'engineering-sync-202',
    title: 'Engineering Team Sync',
    type: 'Team Sync',
    description: 'Weekly engineering team synchronization meeting',
    participantCount: 12,
    lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    isActive: false,
    recentMeetings: 15
  },
  {
    id: 'product-review-303',
    title: 'Product Review Meeting',
    type: 'Product Review',
    description: 'Monthly product roadmap and feature review',
    participantCount: 7,
    lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    isActive: false,
    recentMeetings: 4
  }
];

// Mock data for one-off meetings - will be replaced with API calls
const mockOneOffMeetings = [
  {
    id: 'instant-123',
    roomName: 'daily-standup-2024-01-15',
    title: 'Morning Standup',
    type: 'STANDUP',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    endedAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
    participantCount: 4,
    duration: 30,
    hasTranscripts: true,
    hasSummary: true
  },
  {
    id: 'instant-124',
    roomName: 'client-call-urgent',
    title: 'Urgent Client Discussion',
    type: 'CLIENT',
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    endedAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
    participantCount: 3,
    duration: 45,
    hasTranscripts: true,
    hasSummary: false
  },
  {
    id: 'instant-125',
    roomName: 'quick-sync-backend',
    type: 'SYNC',
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000), // 3 days ago + 15 min
    participantCount: 2,
    duration: 15,
    hasTranscripts: false,
    hasSummary: false
  },
  {
    id: 'instant-126',
    roomName: 'product-demo-live',
    title: 'Product Demo Session',
    type: 'DEMO',
    startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    endedAt: undefined, // Still active
    participantCount: 7,
    duration: undefined,
    hasTranscripts: true,
    hasSummary: false
  },
  {
    id: 'instant-127',
    roomName: 'design-review-q4',
    title: 'Q4 Design Review',
    type: 'REVIEW',
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    endedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 5 days ago + 1 hour
    participantCount: 6,
    duration: 60,
    hasTranscripts: true,
    hasSummary: true
  },
  {
    id: 'instant-128',
    roomName: 'sprint-retrospective',
    title: 'Sprint Retrospective',
    type: 'REVIEW',
    startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 1 week ago + 45 min
    participantCount: 5,
    duration: 45,
    hasTranscripts: false,
    hasSummary: true
  },
  {
    id: 'instant-129',
    roomName: 'bug-triage-session',
    title: 'Critical Bug Triage',
    type: 'PLANNING',
    startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    endedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), // 10 days ago + 90 min
    participantCount: 8,
    duration: 90,
    hasTranscripts: true,
    hasSummary: false
  }
];

export default function HomePage() {
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showAllMeetings, setShowAllMeetings] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState(mockMeetingRooms);
  const [oneOffMeetings, setOneOffMeetings] = useState(mockOneOffMeetings);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Replace with actual API calls
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMeetingRooms(mockMeetingRooms);
      setOneOffMeetings(mockOneOffMeetings);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sort meetings by most recent and limit to 2 for landing page
  const sortedOneOffMeetings = [...oneOffMeetings].sort((a, b) => {
    const dateA = a.startedAt || new Date(0);
    const dateB = b.startedAt || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const meetingRoomsPreview = meetingRooms.slice(0, 4);
  const recentMeetingsPreview = sortedOneOffMeetings.slice(0, 2);
  const hasMoreRooms = meetingRooms.length > 4;
  const hasMoreMeetings = oneOffMeetings.length > 2;

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
        meetings={sortedOneOffMeetings}
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h1>Ohm</h1>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.refreshButton} onClick={fetchData}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="23,4 23,10 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="1,20 1,14 7,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.mainContent}>
          
          {/* Left Section - Start Meeting */}
          <section className={styles.leftSection}>
            <div className={styles.startMeetingCard}>
              <div className={styles.startMeetingIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              
              <div className={styles.startMeetingContent}>
                <h2 className={styles.startMeetingTitle}>Ready to meet?</h2>
                <p className={styles.startMeetingDescription}>
                  Start an instant video call or create a persistent meeting room for your team
                </p>
                
                <button 
                  onClick={() => setShowCreatePopup(true)}
                  className={styles.startMeetingButton}
                >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
                  Start Meeting
          </button>
              </div>
            </div>
          </section>

          {/* Right Section - Meeting Content */}
          <section className={styles.rightSection}>
            {/* Meeting Rooms Section */}
            <div className={styles.meetingSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderContent}>
                  <div>
                    <h2 className={styles.sectionTitle}>Your Meeting Rooms</h2>
                    <p className={styles.sectionDescription}>
                      Persistent spaces for your team meetings and collaboration
                    </p>
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
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            </div>

            {/* Recent Meetings Section */}
            <div className={styles.meetingSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderContent}>
                  <div>
                    <h2 className={styles.sectionTitle}>Recent Meetings</h2>
                    <p className={styles.sectionDescription}>
                      Your recent one-off meetings and instant calls
                    </p>
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
                  <p>Loading recent meetings...</p>
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
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <polygon points="10,8 16,12 10,16" fill="currentColor"/>
              </svg>
            </div>
                  <h3 className={styles.emptyStateTitle}>No recent meetings</h3>
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
            </div>
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
