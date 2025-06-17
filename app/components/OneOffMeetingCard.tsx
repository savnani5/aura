'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/OneOffMeetingCard.module.css';

interface OneOffMeeting {
  id: string;
  roomName: string;
  title?: string;
  type: string;
  startedAt?: Date;
  endedAt?: Date;
  participantCount: number;
  duration?: number; // in minutes
  hasTranscripts: boolean;
  hasSummary: boolean;
}

interface OneOffMeetingCardProps {
  meeting: OneOffMeeting;
}

export function OneOffMeetingCard({ meeting }: OneOffMeetingCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/meeting/${meeting.id}/summary`);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getMeetingIcon = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'STANDUP': '🚀',
      'ONE_ON_ONE': '👥',
      'PROJECT': '📋',
      'CLIENT': '🤝',
      'REVIEW': '🔍',
      'PLANNING': '📅',
      'SYNC': '🔄',
      'DEMO': '📺'
    };
    
    const upperType = type.toUpperCase();
    for (const key in typeMap) {
      if (upperType.includes(key)) {
        return typeMap[key];
      }
    }
    return '📞'; // Default meeting icon
  };

  return (
    <div 
      className={styles.meetingCard}
      onClick={handleCardClick}
    >
      <div className={styles.cardHeader}>
        <div className={styles.meetingIcon}>
          {getMeetingIcon(meeting.type)}
        </div>
        <div className={styles.meetingInfo}>
          <h3 className={styles.meetingTitle}>
            {meeting.title || `${meeting.type} Meeting`}
          </h3>
          <span className={styles.meetingType}>{meeting.type}</span>
        </div>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.meetingDetails}>
          {meeting.startedAt && (
            <div className={styles.meetingDate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {formatDate(meeting.startedAt)}
            </div>
          )}

          {meeting.duration && (
            <div className={styles.meetingDuration}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {formatDuration(meeting.duration)}
            </div>
          )}

          <div className={styles.participantCount}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7ZM23 21V19C23 16.7909 21.2091 15 19 15C17.0587 15 15.3776 16.2776 15.0172 18M19 7C19 9.20914 17.2091 11 15 11C13.7507 11 12.6204 10.4735 11.8852 9.60793" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {meeting.participantCount} participants
          </div>
        </div>

        <div className={styles.meetingFeatures}>
          {meeting.hasTranscripts && (
            <div className={styles.feature}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Transcript
            </div>
          )}
          {meeting.hasSummary && (
            <div className={styles.feature}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              AI Summary
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 