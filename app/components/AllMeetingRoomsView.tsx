'use client';

import React, { useState } from 'react';
import { MeetingRoomCard } from './MeetingRoomCard';
import styles from '@/styles/AllMeetingRoomsView.module.css';

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

interface AllMeetingRoomsViewProps {
  meetingRooms: MeetingRoom[];
  onBack: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function AllMeetingRoomsView({ 
  meetingRooms, 
  onBack, 
  onRefresh, 
  isLoading 
}: AllMeetingRoomsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'active'>('recent');

  const filteredAndSortedRooms = React.useMemo(() => {
    let filtered = meetingRooms.filter(room =>
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case 'recent':
        return filtered.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      case 'name':
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'active':
        return filtered.sort((a, b) => {
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
      default:
        return filtered;
    }
  }, [meetingRooms, searchQuery, sortBy]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button onClick={onBack} className={styles.backButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={styles.title}>
              <h1>All Meeting Rooms</h1>
              <p>{meetingRooms.length} total rooms</p>
            </div>
          </div>
          <button onClick={onRefresh} className={styles.refreshButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="23,4 23,10 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="1,20 1,14 7,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search meeting rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.sortContainer}>
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'active')}
            className={styles.sortSelect}
          >
            <option value="recent">Most Recent</option>
            <option value="name">Name</option>
            <option value="active">Active First</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading meeting rooms...</p>
          </div>
        ) : filteredAndSortedRooms.length > 0 ? (
          <div className={styles.roomsGrid}>
            {filteredAndSortedRooms.map((room) => (
              <MeetingRoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : searchQuery ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>No rooms found</h3>
            <p className={styles.emptyStateDescription}>
              No meeting rooms match your search for &quot;{searchQuery}&quot;
            </p>
            <button 
              onClick={() => setSearchQuery('')}
              className={styles.clearSearchButton}
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>No meeting rooms</h3>
            <p className={styles.emptyStateDescription}>
              Create your first meeting room to get started
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 