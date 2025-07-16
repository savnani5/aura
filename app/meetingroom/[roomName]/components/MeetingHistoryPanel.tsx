'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import styles from '@/styles/MeetingHistoryPanel.module.css';
import { 
  Calendar, 
  Clock, 
  Users, 
  Search,
  Filter,
  Video,
  FileText,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  Ban
} from 'lucide-react';

interface Meeting {
  id: string;
  roomName: string;
  title: string;
  type: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  isUpcoming?: boolean;
  recurringPattern?: {
    frequency: string;
    day: string;
    time: string;
  };
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
  onMeetingSelect?: (meetingId: string) => void;
}

export function MeetingHistoryPanel({ roomName, onMeetingSelect }: MeetingHistoryPanelProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [joiningMeeting, setJoiningMeeting] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoaded) return; // Wait for user to load
    
    if (!user) {
      // Guest user - don't fetch dashboard data
      console.log('Guest user detected - Meeting history not available for guests');
      setMeetings([]);
      setLoading(false);
      return;
    }

    fetchMeetings();
  }, [dateFilter, user, userLoaded]);

  const fetchMeetings = async () => {
    // Check if user is authenticated before making API calls
    if (!user) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch real meeting history from API
      const params = new URLSearchParams();
      if (dateFilter !== 'all') {
        params.append('dateFilter', dateFilter);
      }
      
      const response = await fetch(`/api/meetings/${roomName}/history?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch meeting history');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Transform the data to match our interface
        const transformedMeetings: Meeting[] = data.data.map((meeting: any) => ({
          id: meeting.id || meeting._id,
          roomName: meeting.roomName,
          title: meeting.title || meeting.type,
          type: meeting.type,
          startTime: meeting.startTime || meeting.startedAt,
          endTime: meeting.endTime || meeting.endedAt,
          duration: meeting.duration,
          isUpcoming: meeting.isUpcoming,
          recurringPattern: meeting.recurringPattern,
          participants: meeting.participants || [],
          summary: meeting.summary ? {
            summary: meeting.summary.content,
            keyPoints: meeting.summary.keyPoints || [],
            actionItems: meeting.summary.actionItems || [],
            decisions: meeting.summary.decisions || []
          } : undefined,
          transcript: meeting.transcripts ? meeting.transcripts.map((t: any) => ({
            speaker: t.speaker,
            text: t.text,
            timestamp: new Date(t.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          })) : undefined
        }));
        
        setMeetings(transformedMeetings);
      } else {
        console.error('API error:', data.error);
        setMeetings([]);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async (meeting: Meeting) => {
    setJoiningMeeting(meeting.id);
    
    try {
      // Create meeting record in database
      const response = await fetch('/api/meetings/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomName,
          roomId: roomName, // Use roomName as roomId to find the meeting room
          title: meeting.title,
          type: meeting.type,
          participantName: 'Participant', // Default participant name
          isUpcoming: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Joined meeting:', data);
      } else {
        console.warn('Failed to create meeting record, proceeding anyway');
      }
      
      // Navigate to the live video meeting
      router.push(`/rooms/${roomName}`);
    } catch (error) {
      console.error('Error joining meeting:', error);
      // Still navigate to meeting even if database record creation fails
      router.push(`/rooms/${roomName}`);
    } finally {
      setJoiningMeeting(null);
    }
  };



  const formatDate = (dateString: string, isUpcoming: boolean = false) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (isUpcoming) {
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Format time
      const timeStr = date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      // Format day
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (diffDays === 0) return `Today at ${timeStr}`;
      if (diffDays === 1) return `Tomorrow at ${timeStr}`;
      if (diffDays < 7) return `${dayName} at ${timeStr}`;
      return `${dayName}, ${dateStr} at ${timeStr}`;
    }
    
    // Fixed logic for past meetings - use proper date comparison
    const meetingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = todayDate.getTime() - meetingDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  // If user is not loaded yet, show loading
  if (!userLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated (guest), show message
  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.guestMessage}>
          <Ban size={48} />
          <h3>Meeting History Not Available</h3>
          <p>Meeting history is only available to authenticated meeting participants. Please sign in to access this feature.</p>
        </div>
      </div>
    );
  }

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
              key={meeting.isUpcoming ? `upcoming-${meeting.startTime}` : meeting.id}
              className={`${styles.meetingCard} ${meeting.isUpcoming ? styles.upcomingMeeting : ''}`}
              onClick={() => meeting.isUpcoming ? null : onMeetingSelect?.(meeting.id)}
              style={{ cursor: meeting.isUpcoming ? 'default' : 'pointer' }}
            >
              {meeting.isUpcoming && (
                <div className={styles.upcomingBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Upcoming
                </div>
              )}
              
              <div className={styles.meetingHeader}>
                <div className={styles.meetingInfo}>
                  <h4 className={styles.meetingTitle}>{meeting.title}</h4>
                  <div className={styles.meetingMeta}>
                    <span className={`${styles.meetingType} ${styles[meeting.type.toLowerCase()]}`}>
                      {meeting.type}
                    </span>
                    <span className={`${styles.meetingDate} ${meeting.isUpcoming ? styles.upcomingDate : ''}`}>
                      {formatDate(meeting.startTime, meeting.isUpcoming)}
                    </span>
                    {meeting.isUpcoming && meeting.recurringPattern && (
                      <span className={styles.recurringInfo}>
                        {meeting.recurringPattern.frequency} • {meeting.recurringPattern.day}s
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

              {meeting.summary && !meeting.isUpcoming && (
                <div className={styles.meetingSummary}>
                  <p>{meeting.summary.summary}</p>
                </div>
              )}
              
              {meeting.isUpcoming && (
                <div className={styles.upcomingActions}>
                  <button 
                    className={styles.joinButton} 
                    onClick={(e) => { e.stopPropagation(); handleJoinMeeting(meeting); }}
                    disabled={joiningMeeting === meeting.id}
                  >
                    {joiningMeeting === meeting.id ? (
                      <>
                        <div className={styles.spinner} />
                        Joining...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 3L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 14V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V6C3.9 4 5 4H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Join Meeting
                      </>
                    )}
                  </button>
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
    </div>
  );
} 