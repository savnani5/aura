'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser, UserButton } from '@clerk/nextjs';
import { CreateMeetingPopup } from './CreateMeetingPopup';
import { MeetingRoomCard } from './MeetingRoomCard';
import { AllMeetingRoomsView } from './AllMeetingRoomsView';
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

export function Dashboard() {
  const { user } = useUser();
  const [showCreateRoomPopup, setShowCreateRoomPopup] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real data from API endpoints
  const fetchData = async () => {
    setIsLoading(true);
    console.log('🔄 Starting fetchData...');
    
    try {
      // Fetch meeting rooms
      console.log('📡 Making API call for meeting rooms...');
      const roomsResponse = await fetch('/api/meetings');
      
      console.log('📡 API response received:', {
        roomsStatus: roomsResponse.status
      });
      
      // Handle meeting rooms
      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json();
        console.log('🏠 Meeting rooms API response:', roomsData);
        
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
          console.log('🏠 Formatted meeting rooms:', formattedRooms);
          setMeetingRooms(formattedRooms);
        } else {
          // API returned success: false, but this might just mean no data
          console.log('⚠️ No meeting rooms found for user:', roomsData.message || roomsData.error);
          setMeetingRooms([]);
        }
      } else if (roomsResponse.status === 401) {
        // Unauthorized - user might not be properly authenticated yet
        console.log('🔒 User not authenticated for meeting rooms');
        setMeetingRooms([]);
      } else {
        // Only throw error for actual server errors (5xx), not empty results
        console.warn('⚠️ Failed to fetch meeting rooms:', roomsResponse.status, roomsResponse.statusText);
        setMeetingRooms([]);
      }
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      // Don't set error state for network issues, just log and show empty state
      console.log('📝 Setting empty arrays due to fetch error');
      setMeetingRooms([]);
    } finally {
      setIsLoading(false);
      console.log('✅ fetchData completed');
    }
  };

  // Refresh data when a new meeting is created
  const handleMeetingCreated = async () => {
    console.log('🔄 Meeting created, refreshing data...');
    await fetchData(); // Refresh all data
    console.log('✅ Data refreshed, meeting rooms count:', meetingRooms.length);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const meetingRoomsPreview = meetingRooms.slice(0, 3);
  const hasMoreRooms = meetingRooms.length > 3;

  const handleViewAllRooms = () => {
    setShowAllRooms(true);
  };

  // If showing all rooms, render the respective component
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

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <Image 
              src="/images/ohm-icon.svg" 
              alt="Ohm" 
              width={32} 
              height={32} 
              className={styles.logo}
            />
            <h1 className={styles.appName}>Ohm</h1>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.welcomeText}>
              Welcome back, {user?.firstName || user?.fullName || 'User'}!
            </span>
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "bg-gray-900 border border-gray-700",
                  userButtonPopoverActionButton: "text-gray-300 hover:text-white hover:bg-gray-800",
                }
              }}
            />
          </div>
        </div>
      </header>

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
                <div className={styles.headerActions}>
                  <button 
                    onClick={() => setShowCreateRoomPopup(true)}
                    className={styles.createButton}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
                      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Create Room
                  </button>
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
                  onClick={() => setShowCreateRoomPopup(true)}
                  className={styles.emptyStateButton}
                >
                  Create Meeting Room
                </button>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Create Meeting Popup */}
      <CreateMeetingPopup 
        isOpen={showCreateRoomPopup}
        onClose={() => setShowCreateRoomPopup(false)}
        onMeetingCreated={() => {
          handleMeetingCreated();
          setShowCreateRoomPopup(false);
        }}
      />
    </div>
  );
}