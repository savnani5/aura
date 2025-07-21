'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/MeetingRoomCard.module.css';
import { MeetingStorageUtils } from '@/lib/state';

interface MeetingRoom {
  id: string;
  title: string;
  type: string;
  description?: string;
  participantCount: number;
  lastActivity?: Date;
  isActive?: boolean; // If there's an ongoing meeting
  recentMeetings?: number; // Number of recent meetings
}

interface MeetingRoomCardProps {
  room: MeetingRoom;
}

export function MeetingRoomCard({ room }: MeetingRoomCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/meetingroom/${room.id}`);
  };

  const handleQuickJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Create meeting record in database
      const response = await fetch('/api/meetings/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: room.id,
          roomId: room.id,
          participantName: 'Quick Join User'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Quick joined meeting:', data);
        
        // Store meetingId in Zustand store (replaces localStorage)
        if (data.success && data.data?.meetingId) {
          MeetingStorageUtils.setMeetingId(room.id, data.data.meetingId);
        }
      } else {
        console.warn('Failed to create meeting record, proceeding anyway');
      }
      
      // Navigate directly to the video meeting
      router.push(`/rooms/${room.id}`);
    } catch (error) {
      console.error('Error quick joining meeting:', error);
      // Still navigate to meeting even if database record creation fails
      router.push(`/rooms/${room.id}`);
    }
  };

  const formatLastActivity = (date?: Date) => {
    if (!date) return 'No recent activity';
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Active now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const getMeetingTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('standup') || lowerType.includes('daily')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    }
    
    if (lowerType.includes('one-on-one') || lowerType.includes('1:1')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    }
    
    if (lowerType.includes('project') || lowerType.includes('planning')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    }
    
    if (lowerType.includes('client') || lowerType.includes('review')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    }
    
    // Default icon for other meeting types
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
      </svg>
    );
  };

  return (
    <div 
      className={`${styles.card} ${room.isActive ? styles.cardActive : ''}`}
      onClick={handleCardClick}
    >
      {/* Card Header */}
      <div className={styles.cardHeader}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>{room.title}</h3>
          <div className={styles.typeTag}>
            {getMeetingTypeIcon(room.type)}
            <span>{room.type}</span>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className={styles.cardContent}>
        {room.description && (
          <p className={styles.description}>{room.description}</p>
        )}
        
        <div className={styles.stats}>
          <div className={styles.stat}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>{room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}</span>
          </div>
          
          {room.recentMeetings !== undefined && (
            <div className={styles.stat}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>{room.recentMeetings} meeting{room.recentMeetings !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.lastActivity}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>{formatLastActivity(room.lastActivity)}</span>
        </div>
        
        <div className={styles.cardActions}>
          <button 
            className={styles.actionButton}
            onClick={handleQuickJoin}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
} 