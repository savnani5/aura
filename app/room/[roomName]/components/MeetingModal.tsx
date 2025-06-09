'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/styles/MeetingModal.module.css';

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
}

interface MeetingSummary {
  id: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: Date;
  aiModel?: string;
}

interface Participant {
  id: string;
  participantName: string;
  joinedAt: Date;
  leftAt?: Date;
  isHost: boolean;
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
}

interface MeetingModalProps {
  meetingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MeetingModal({ meetingId, isOpen, onClose }: MeetingModalProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('summary');

  useEffect(() => {
    if (isOpen && meetingId) {
      fetchMeetingDetails();
    }
  }, [isOpen, meetingId]);

  const fetchMeetingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for demonstration - replace with actual API call later
      const mockMeeting: Meeting = {
        id: meetingId,
        roomName: meetingId,
        title: 'Weekly Standup Meeting',
        type: 'STANDUP',
        startedAt: new Date(Date.now() - 86400000),
        endedAt: new Date(Date.now() - 86400000 + 1800000),
        participants: [
          {
            id: '1',
            participantName: 'Alice Johnson',
            joinedAt: new Date(Date.now() - 86400000),
            isHost: true
          },
          {
            id: '2',
            participantName: 'Bob Smith',
            joinedAt: new Date(Date.now() - 86400000 + 300000),
            isHost: false
          },
          {
            id: '3',
            participantName: 'Carol Davis',
            joinedAt: new Date(Date.now() - 86400000 + 600000),
            leftAt: new Date(Date.now() - 86400000 + 1500000),
            isHost: false
          }
        ],
        transcripts: [
          {
            id: '1',
            speaker: 'Alice Johnson',
            text: 'Good morning everyone! Let\'s start our weekly standup. Bob, would you like to go first?',
            timestamp: new Date(Date.now() - 86400000 + 60000)
          },
          {
            id: '2',
            speaker: 'Bob Smith',
            text: 'Sure! This week I completed the user authentication module and started working on the dashboard. I\'m blocked on the API integration though.',
            timestamp: new Date(Date.now() - 86400000 + 120000)
          },
          {
            id: '3',
            speaker: 'Carol Davis',
            text: 'I can help with that API integration, Bob. I just finished the backend endpoints yesterday.',
            timestamp: new Date(Date.now() - 86400000 + 180000)
          },
          {
            id: '4',
            speaker: 'Alice Johnson',
            text: 'Perfect! Carol, can you sync with Bob after this meeting? What about you Carol, what did you work on?',
            timestamp: new Date(Date.now() - 86400000 + 240000)
          },
          {
            id: '5',
            speaker: 'Carol Davis',
            text: 'I completed the API endpoints for user management and started the documentation. No blockers on my end.',
            timestamp: new Date(Date.now() - 86400000 + 300000)
          },
          {
            id: '6',
            speaker: 'Alice Johnson',
            text: 'Excellent work everyone! Let\'s wrap up. Bob and Carol, please sync on the API integration today.',
            timestamp: new Date(Date.now() - 86400000 + 1500000)
          }
        ],
        summaries: [
          {
            id: '1',
            summary: 'Team discussed weekly progress. Bob completed user authentication and started dashboard work but is blocked on API integration. Carol finished backend endpoints and offered to help Bob. Team is making good progress overall.',
            keyPoints: [
              'User authentication module completed by Bob',
              'Dashboard development in progress',
              'Backend API endpoints completed by Carol',
              'Documentation started for new endpoints'
            ],
            actionItems: [
              'Bob and Carol to sync on API integration today',
              'Complete dashboard integration by end of week',
              'Finish API documentation by Friday'
            ],
            decisions: [
              'Carol will assist Bob with API integration',
              'Next standup scheduled for same time next week'
            ],
            generatedAt: new Date(Date.now() - 86400000 + 1800000),
            aiModel: 'Claude 3.5 Sonnet'
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMeeting(mockMeeting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
      console.error('Error fetching meeting details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (startedAt?: Date, endedAt?: Date) => {
    if (!startedAt) return 'Not started';
    if (!endedAt) return 'In progress';
    
    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.meetingInfo}>
              <h2 className={styles.title}>
                {meeting?.title || 'Meeting Details'}
              </h2>
              <div className={styles.metadata}>
                <span className={styles.type}>{meeting?.type}</span>
                <span className={styles.duration}>
                  {formatDuration(meeting?.startedAt, meeting?.endedAt)}
                </span>
                <span className={styles.participants}>
                  {meeting?.participants.length} participants
                </span>
              </div>
            </div>
            
            <button onClick={onClose} className={styles.closeButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              onClick={() => setActiveTab('summary')}
              className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Summary
            </button>
            
            <button
              onClick={() => setActiveTab('transcript')}
              className={`${styles.tab} ${activeTab === 'transcript' ? styles.tabActive : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Transcript
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading meeting details...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <div className={styles.errorIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3>Failed to Load Meeting</h3>
              <p>{error}</p>
              <button onClick={fetchMeetingDetails} className={styles.retryButton}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && (
                <SummaryTab meeting={meeting} />
              )}
              
              {activeTab === 'transcript' && (
                <TranscriptTab 
                  transcripts={meeting?.transcripts || []} 
                  formatTimestamp={formatTimestamp}
                  getInitials={getInitials}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Summary Tab Component
interface SummaryTabProps {
  meeting: Meeting | null;
}

function SummaryTab({ meeting }: SummaryTabProps) {
  const summary = meeting?.summaries?.[0]; // Latest summary

  if (!meeting) return null;

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
        <>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>AI Summary</h3>
              <span className={styles.aiModel}>
                {summary.aiModel && `Generated by ${summary.aiModel}`}
              </span>
            </div>
            <div className={styles.summaryContent}>
              <p>{summary.summary}</p>
            </div>
          </div>

          {/* Key Points */}
          {summary.keyPoints.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Key Points</h3>
              <ul className={styles.pointsList}>
                {summary.keyPoints.map((point, index) => (
                  <li key={index} className={styles.pointItem}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {summary.actionItems.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Action Items</h3>
              <ul className={styles.pointsList}>
                {summary.actionItems.map((item, index) => (
                  <li key={index} className={styles.actionItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          {summary.decisions.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Decisions Made</h3>
              <ul className={styles.pointsList}>
                {summary.decisions.map((decision, index) => (
                  <li key={index} className={styles.decisionItem}>
                    {decision}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className={styles.noSummary}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <h3>No Summary Available</h3>
          <p>AI summary will be generated after the meeting ends.</p>
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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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