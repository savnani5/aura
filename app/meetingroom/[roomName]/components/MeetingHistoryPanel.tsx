'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/styles/MeetingHistoryPanel.module.css';
import { MeetingModal } from './MeetingModal';

interface Meeting {
  id: string;
  roomName: string;
  title: string;
  type: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  participants: Array<{
    name: string;
    joinedAt: string;
    leftAt?: string;
    isHost: boolean;
  }>;
  summary?: {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    decisions: string[];
  };
  transcript?: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
}

interface MeetingHistoryPanelProps {
  roomName: string;
}

export function MeetingHistoryPanel({ roomName }: MeetingHistoryPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    fetchMeetings();
  }, [roomName]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      // Remove artificial delay - history loads instantly from indexed database
      // await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockMeetings: Meeting[] = [
        {
          id: '1',
          roomName,
          title: 'Daily Standup - Sprint 23',
          type: 'STANDUP',
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T09:30:00Z',
          duration: 30,
          participants: [
            { name: 'John Doe', joinedAt: '2024-01-15T09:00:00Z', leftAt: '2024-01-15T09:30:00Z', isHost: true },
            { name: 'Jane Smith', joinedAt: '2024-01-15T09:02:00Z', leftAt: '2024-01-15T09:30:00Z', isHost: false },
            { name: 'Mike Johnson', joinedAt: '2024-01-15T09:01:00Z', leftAt: '2024-01-15T09:28:00Z', isHost: false }
          ],
          summary: {
            summary: 'Daily standup meeting covering sprint progress and blockers.',
            keyPoints: ['Sprint is on track', 'New feature deployment scheduled', 'Team velocity improved'],
            actionItems: ['Complete user authentication', 'Review pull requests', 'Update documentation'],
            decisions: ['Deploy to staging environment', 'Schedule code review session']
          },
          transcript: [
            { speaker: 'John Doe', text: 'Good morning everyone, let\'s start our daily standup.', timestamp: '09:00:15' },
            { speaker: 'Jane Smith', text: 'Yesterday I completed the user profile feature.', timestamp: '09:01:22' },
            { speaker: 'Mike Johnson', text: 'I\'m working on the API integration and should finish today.', timestamp: '09:02:45' }
          ]
        },
        {
          id: '2',
          roomName,
          title: 'Project Planning Session',
          type: 'PROJECT',
          startTime: '2024-01-14T14:00:00Z',
          endTime: '2024-01-14T15:30:00Z',
          duration: 90,
          participants: [
            { name: 'Alice Wilson', joinedAt: '2024-01-14T14:00:00Z', leftAt: '2024-01-14T15:30:00Z', isHost: true },
            { name: 'Bob Brown', joinedAt: '2024-01-14T14:05:00Z', leftAt: '2024-01-14T15:25:00Z', isHost: false }
          ],
          summary: {
            summary: 'Project planning session for Q1 roadmap and resource allocation.',
            keyPoints: ['Q1 priorities defined', 'Resource allocation reviewed', 'Timeline established'],
            actionItems: ['Create project timeline', 'Assign team members', 'Set up tracking tools'],
            decisions: ['Focus on mobile app development', 'Hire additional developers']
          }
        },
        {
          id: '3',
          roomName,
          title: '1:1 with Team Lead',
          type: 'ONE_ON_ONE',
          startTime: '2024-01-13T16:00:00Z',
          endTime: '2024-01-13T16:45:00Z',
          duration: 45,
          participants: [
            { name: 'Sarah Davis', joinedAt: '2024-01-13T16:00:00Z', leftAt: '2024-01-13T16:45:00Z', isHost: true },
            { name: 'Tom Wilson', joinedAt: '2024-01-13T16:00:00Z', leftAt: '2024-01-13T16:45:00Z', isHost: false }
          ],
          summary: {
            summary: 'One-on-one meeting discussing career development and current projects.',
            keyPoints: ['Career goals discussion', 'Current project feedback', 'Skill development plan'],
            actionItems: ['Enroll in training course', 'Update portfolio', 'Schedule follow-up'],
            decisions: ['Focus on full-stack development', 'Take on mentoring role']
          }
        }
      ];
      
      setMeetings(mockMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         meeting.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (dateFilter === 'today') {
      const today = new Date().toDateString();
      const meetingDate = new Date(meeting.startTime).toDateString();
      return matchesSearch && meetingDate === today;
    }
    
    if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return matchesSearch && new Date(meeting.startTime) >= weekAgo;
    }
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading meeting history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Meeting History</h2>
          <p className={styles.subtitle}>
            {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19S2 15.194 2 10.5 5.806 2 10.5 2 19 5.806 19 10.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className={styles.dateFilter}
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
        </select>
      </div>

      <div className={styles.meetingsList}>
        {filteredMeetings.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeMiterlimit="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3>No meetings found</h3>
            <p>No meetings match your current search criteria.</p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className={styles.meetingCard}
              onClick={() => setSelectedMeetingId(meeting.id)}
            >
              <div className={styles.meetingHeader}>
                <div className={styles.meetingInfo}>
                  <h4 className={styles.meetingTitle}>{meeting.title}</h4>
                  <div className={styles.meetingMeta}>
                    <span className={`${styles.meetingType} ${styles[meeting.type.toLowerCase()]}`}>
                      {meeting.type}
                    </span>
                    <span className={styles.meetingDate}>
                      {formatDate(meeting.startTime)}
                    </span>
                    {meeting.duration && (
                      <span className={styles.meetingDuration}>
                        {formatDuration(meeting.duration)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.participantCount}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7ZM23 21V19C23 16.7909 21.2091 15 19 15C17.0587 15 15.3776 16.2776 15.0172 18M19 7C19 9.20914 17.2091 11 15 11C13.7507 11 12.6204 10.4735 11.8852 9.60793"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {meeting.participants.length}
                </div>
              </div>

              {meeting.summary && (
                <div className={styles.meetingSummary}>
                  <p>{meeting.summary.summary}</p>
                </div>
              )}

              <div className={styles.meetingParticipants}>
                {meeting.participants.slice(0, 3).map((participant, index) => (
                  <div key={index} className={styles.participantAvatar}>
                    {participant.name.split(' ').map(n => n[0]).join('')}
                  </div>
                ))}
                {meeting.participants.length > 3 && (
                  <div className={styles.moreParticipants}>
                    +{meeting.participants.length - 3}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

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