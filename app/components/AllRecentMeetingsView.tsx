'use client';

import React, { useState } from 'react';
import { OneOffMeetingCard } from './OneOffMeetingCard';
import styles from '@/styles/AllRecentMeetingsView.module.css';

interface OneOffMeeting {
  id: string;
  roomName: string;
  title?: string;
  type: string;
  startedAt?: Date;
  endedAt?: Date;
  participantCount: number;
  duration?: number;
  hasTranscripts: boolean;
  hasSummary: boolean;
}

interface AllRecentMeetingsViewProps {
  meetings: OneOffMeeting[];
  onBack: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function AllRecentMeetingsView({ 
  meetings, 
  onBack, 
  onRefresh, 
  isLoading 
}: AllRecentMeetingsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'completed' | 'with-transcripts' | 'with-summary'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'duration' | 'participants'>('recent');

  const filteredAndSortedMeetings = React.useMemo(() => {
    let filtered = meetings.filter(meeting => {
      // Search filter
      const searchMatch = 
        (meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        meeting.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.roomName.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!searchMatch) return false;

      // Status filter
      switch (filterBy) {
        case 'active':
          return meeting.startedAt && !meeting.endedAt;
        case 'completed':
          return meeting.endedAt;
        case 'with-transcripts':
          return meeting.hasTranscripts;
        case 'with-summary':
          return meeting.hasSummary;
        default:
          return true;
      }
    });

    // Sort
    switch (sortBy) {
      case 'recent':
        return filtered.sort((a, b) => {
          const dateA = a.startedAt || new Date(0);
          const dateB = b.startedAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      case 'duration':
        return filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      case 'participants':
        return filtered.sort((a, b) => b.participantCount - a.participantCount);
      default:
        return filtered;
    }
  }, [meetings, searchQuery, filterBy, sortBy]);

  const activeMeetingsCount = meetings.filter(m => m.startedAt && !m.endedAt).length;
  const completedMeetingsCount = meetings.filter(m => m.endedAt).length;

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
              <h1>All Recent Meetings</h1>
              <p>{meetings.length} total meetings • {activeMeetingsCount} active • {completedMeetingsCount} completed</p>
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
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filtersRow}>
          <div className={styles.filterContainer}>
            <label>Filter:</label>
            <select 
              value={filterBy} 
              onChange={(e) => setFilterBy(e.target.value as any)}
              className={styles.filterSelect}
            >
              <option value="all">All Meetings</option>
              <option value="active">Active Now</option>
              <option value="completed">Completed</option>
              <option value="with-transcripts">With Transcripts</option>
              <option value="with-summary">With AI Summary</option>
            </select>
          </div>
          
          <div className={styles.sortContainer}>
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className={styles.sortSelect}
            >
              <option value="recent">Most Recent</option>
              <option value="duration">Duration</option>
              <option value="participants">Participants</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading meetings...</p>
          </div>
        ) : filteredAndSortedMeetings.length > 0 ? (
          <div className={styles.meetingsGrid}>
            {filteredAndSortedMeetings.map((meeting) => (
              <OneOffMeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        ) : searchQuery || filterBy !== 'all' ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>No meetings found</h3>
            <p className={styles.emptyStateDescription}>
              No meetings match your current search and filters
            </p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterBy('all');
              }}
              className={styles.clearFiltersButton}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polygon points="10,8 16,12 10,16" fill="currentColor"/>
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>No recent meetings</h3>
            <p className={styles.emptyStateDescription}>
              Start an instant meeting to see your calls here
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 