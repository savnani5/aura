'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from '@/styles/MeetingSummaryPage.module.css';

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
}

interface Participant {
  id: string;
  participantName: string;
  joinedAt: Date;
  leftAt?: Date;
  isHost: boolean;
}

interface MeetingSummary {
  id: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: Date;
  aiModel: string;
}

interface Meeting {
  id: string;
  roomName: string;
  title: string;
  type: string;
  startedAt?: Date;
  endedAt?: Date;
  participants: Participant[];
  transcripts: Transcript[];
  summaries: MeetingSummary[];
  duration?: number;
  hasTranscripts: boolean;
  hasSummary: boolean;
}

export default function MeetingSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  const meetingId = params?.meetingId as string;

  useEffect(() => {
    if (meetingId) {
      fetchMeetingDetails();
    }
  }, [meetingId]);

  const fetchMeetingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, using mock data similar to MeetingModal
      // In real implementation, this would be: const response = await fetch(`/api/meetings/${meetingId}/details`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const mockMeeting: Meeting = {
        id: meetingId,
        roomName: 'daily-standup-2024-01-15',
        title: 'Morning Standup',
        type: 'STANDUP',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endedAt: new Date(Date.now() - 90 * 60 * 1000),
        duration: 30,
        hasTranscripts: true,
        hasSummary: true,
        participants: [
          {
            id: '1',
            participantName: 'Alice Johnson',
            joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            leftAt: new Date(Date.now() - 90 * 60 * 1000),
            isHost: true
          },
          {
            id: '2',
            participantName: 'Bob Smith',
            joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            leftAt: new Date(Date.now() - 90 * 60 * 1000),
            isHost: false
          },
          {
            id: '3',
            participantName: 'Carol Davis',
            joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            leftAt: new Date(Date.now() - 90 * 60 * 1000),
            isHost: false
          }
        ],
        transcripts: [
          {
            id: '1',
            speaker: 'Alice Johnson',
            text: 'Good morning everyone! Let\'s start our weekly standup. Bob, would you like to go first?',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000)
          },
          {
            id: '2',
            speaker: 'Bob Smith',
            text: 'Sure! This week I completed the user authentication module and started working on the dashboard. I\'m blocked on the API integration though.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 120000)
          },
          {
            id: '3',
            speaker: 'Carol Davis',
            text: 'I can help with that API integration, Bob. I just finished the backend endpoints yesterday.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180000)
          },
          {
            id: '4',
            speaker: 'Alice Johnson',
            text: 'Perfect! Carol, can you sync with Bob after this meeting? What about you Carol, what did you work on?',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 240000)
          },
          {
            id: '5',
            speaker: 'Carol Davis',
            text: 'I completed the API endpoints for user management and started the documentation. No blockers on my end.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 300000)
          }
        ],
        summaries: [
          {
            id: '1',
            summary: 'Weekly standup meeting focusing on progress updates and coordination. Team discussed authentication module completion, API integration challenges, and documentation progress. Key coordination established between Bob and Carol for API integration support.',
            keyPoints: [
              'User authentication module completed by Bob',
              'Dashboard development in progress',
              'API integration presenting challenges',
              'Backend endpoints completed by Carol',
              'Documentation work initiated'
            ],
            actionItems: [
              'Bob and Carol to sync on API integration after meeting',
              'Complete dashboard development',
              'Finalize API documentation'
            ],
            decisions: [
              'Carol will provide API integration support to Bob',
              'Team to continue with current sprint priorities'
            ],
            generatedAt: new Date(Date.now() - 85 * 60 * 1000),
            aiModel: 'GPT-4'
          }
        ]
      };

      setMeeting(mockMeeting);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
      setError('Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading meeting details...</p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h3>Failed to Load Meeting</h3>
          <p>{error || 'Meeting not found'}</p>
          <button onClick={() => router.back()} className={styles.backButton}>
            Go Back
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
          <button onClick={() => router.back()} className={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          
          <div className={styles.titleSection}>
            <div className={styles.meetingIcon}>
              {getMeetingIcon(meeting.type)}
            </div>
            <div className={styles.titleInfo}>
              <h1 className={styles.title}>{meeting.title}</h1>
              <div className={styles.metadata}>
                <span className={styles.type}>{meeting.type}</span>
                {meeting.startedAt && (
                  <span className={styles.date}>{formatDate(meeting.startedAt)}</span>
                )}
                {meeting.duration && (
                  <span className={styles.duration}>{formatDuration(meeting.duration)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className={styles.navigation}>
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab('summary')}
            className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Summary
          </button>
          
          <button
            onClick={() => setActiveTab('transcript')}
            className={`${styles.tab} ${activeTab === 'transcript' ? styles.tabActive : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Transcript
          </button>
        </div>
      </div>

      {/* Content */}
      <main className={styles.main}>
        {activeTab === 'summary' && (
          <SummaryTab meeting={meeting} />
        )}
        
        {activeTab === 'transcript' && (
          <TranscriptTab 
            transcripts={meeting.transcripts} 
            formatTimestamp={formatTimestamp}
            getInitials={getInitials}
          />
        )}
      </main>
    </div>
  );
}

// Summary Tab Component
interface SummaryTabProps {
  meeting: Meeting;
}

function SummaryTab({ meeting }: SummaryTabProps) {
  const summary = meeting.summaries?.[0]; // Latest summary

  return (
    <div className={styles.summaryTab}>
      {/* Participants Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Participants</h3>
        <div className={styles.participantsList}>
          {meeting.participants.map((participant) => (
            <div key={participant.id} className={styles.participantItem}>
              <div className={styles.participantAvatar}>
                {participant.participantName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className={styles.participantInfo}>
                <span className={styles.participantName}>
                  {participant.participantName}
                  {participant.isHost && <span className={styles.hostBadge}>Host</span>}
                </span>
                <span className={styles.participantTime}>
                  Joined: {new Date(participant.joinedAt).toLocaleTimeString()}
                  {participant.leftAt && ` • Left: ${new Date(participant.leftAt).toLocaleTimeString()}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary Section */}
      {summary ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>AI Summary</h3>
          <div className={styles.summaryContent}>
            <p className={styles.summaryText}>{summary.summary}</p>
            
            {summary.keyPoints.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Key Points</h4>
                <ul>
                  {summary.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.actionItems.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Action Items</h4>
                <ul>
                  {summary.actionItems.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.decisions.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Decisions Made</h4>
                <ul>
                  {summary.decisions.map((decision, index) => (
                    <li key={index}>{decision}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>AI Summary</h3>
          <div className={styles.noSummary}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h4>No AI Summary Available</h4>
            <p>AI summary will be generated after the meeting ends.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Transcript Tab Component
interface TranscriptTabProps {
  transcripts: Transcript[];
  formatTimestamp: (timestamp: Date) => string;
  getInitials: (name: string) => string;
}

function TranscriptTab({ transcripts, formatTimestamp, getInitials }: TranscriptTabProps) {
  if (transcripts.length === 0) {
    return (
      <div className={styles.emptyTranscript}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <h3>No Transcript Available</h3>
        <p>Transcript will appear here during the meeting.</p>
      </div>
    );
  }

  return (
    <div className={styles.transcriptTab}>
      <div className={styles.transcriptList}>
        {transcripts.map((transcript) => (
          <div key={transcript.id} className={styles.transcriptItem}>
            <div className={styles.transcriptHeader}>
              <div className={styles.speakerInfo}>
                <div className={styles.speakerAvatar}>
                  {getInitials(transcript.speaker)}
                </div>
                <span className={styles.speakerName}>{transcript.speaker}</span>
              </div>
              <span className={styles.timestamp}>
                {formatTimestamp(transcript.timestamp)}
              </span>
            </div>
            <div className={styles.transcriptText}>
              {transcript.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 