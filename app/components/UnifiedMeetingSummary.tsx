'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/UnifiedMeetingSummary.module.css';

interface Transcript {
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
  aiModel?: string;
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

interface UnifiedMeetingSummaryProps {
  meetingId: string;
  // Modal props (when used as modal)
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  // Page props (when used as standalone page)
  onBack?: () => void;
}

export function UnifiedMeetingSummary({ 
  meetingId, 
  isModal = false, 
  isOpen = true, 
  onClose, 
  onBack 
}: UnifiedMeetingSummaryProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    if ((isModal && isOpen && meetingId) || (!isModal && meetingId)) {
      fetchMeetingDetails();
    }
  }, [isModal, isOpen, meetingId]);

  const fetchMeetingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real meeting details from API - updated endpoint path
      const response = await fetch(`/api/meeting-details/${meetingId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch meeting details');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const meetingData = data.data;
        
        // Check if meeting just ended and summary is being generated
        const hasTranscripts = meetingData.transcripts && meetingData.transcripts.length > 0;
        const hasSummary = !!meetingData.summary;
        const justEnded = meetingData.endedAt && !hasSummary && hasTranscripts;
        
        if (justEnded) {
          setIsGeneratingSummary(true);
          // Poll for summary completion every 3 seconds
          const pollInterval = setInterval(async () => {
            try {
              const pollResponse = await fetch(`/api/meeting-details/${meetingId}`);
              const pollData = await pollResponse.json();
              if (pollData.success && pollData.data.summary) {
                setIsGeneratingSummary(false);
                clearInterval(pollInterval);
                // Refresh the meeting data
                fetchMeetingDetails();
              }
            } catch (error) {
              console.error('Error polling for summary:', error);
              // Stop polling after error, but don't fail
              setIsGeneratingSummary(false);
              clearInterval(pollInterval);
            }
          }, 3000);
          
          // Stop polling after 2 minutes if summary not generated
          setTimeout(() => {
            setIsGeneratingSummary(false);
            clearInterval(pollInterval);
          }, 120000);
        }
        
        // Transform the data to match our interface
        const transformedMeeting: Meeting = {
          id: meetingData._id,
          roomName: meetingData.roomName,
          title: meetingData.title || meetingData.type,
          type: meetingData.type,
          startedAt: new Date(meetingData.startedAt),
          endedAt: meetingData.endedAt ? new Date(meetingData.endedAt) : undefined,
          duration: meetingData.duration,
          hasTranscripts: meetingData.transcripts && meetingData.transcripts.length > 0,
          hasSummary: !!meetingData.summary,
          participants: meetingData.participants.map((p: any) => ({
            id: p.userId || p.name.toLowerCase().replace(/\s+/g, '-'),
            participantName: p.name,
            joinedAt: new Date(p.joinedAt),
            leftAt: p.leftAt ? new Date(p.leftAt) : undefined,
            isHost: p.isHost
          })),
          transcripts: meetingData.transcripts ? meetingData.transcripts.map((t: any) => ({
            speaker: t.speaker,
            text: t.text,
            timestamp: new Date(t.timestamp)
          })) : [],
          summaries: meetingData.summary ? [{
            id: '1',
            summary: meetingData.summary.content,
            keyPoints: meetingData.summary.keyPoints || [],
            actionItems: meetingData.summary.actionItems || [],
            decisions: meetingData.summary.decisions || [],
            generatedAt: new Date(meetingData.summary.generatedAt || meetingData.updatedAt),
            aiModel: 'Claude 3.5 Sonnet'
          }] : []
        };

        setMeeting(transformedMeeting);
      } else {
        setError(data.error || 'Failed to load meeting details');
      }
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

  const handleBack = () => {
    if (isModal && onClose) {
      onClose();
    } else if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Don't render modal if not open
  if (isModal && !isOpen) return null;

  const content = (
    <>
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading meeting details...</p>
        </div>
      ) : error || !meeting ? (
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
          <button onClick={handleBack} className={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.titleSection}>
                <button onClick={handleBack} className={styles.backButton}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
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
              
              <div className={styles.participantBlobs}>
                {meeting.participants.slice(0, 4).map((participant, index) => (
                  <div 
                    key={participant.id} 
                    className={`${styles.participantBlob} ${participant.isHost ? styles.hostBlob : ''}`}
                    style={{ zIndex: meeting.participants.length - index }}
                    title={`${participant.participantName}${participant.isHost ? ' (Host)' : ''}`}
                  >
                    {getInitials(participant.participantName)}
                  </div>
                ))}
                {meeting.participants.length > 4 && (
                  <div className={styles.participantBlob} title={`+${meeting.participants.length - 4} more`}>
                    +{meeting.participants.length - 4}
                  </div>
                )}
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
              <SummaryTab meeting={meeting} isGeneratingSummary={isGeneratingSummary} />
            )}
            
            {activeTab === 'transcript' && (
              <TranscriptTab 
                transcripts={meeting.transcripts} 
                formatTimestamp={formatTimestamp}
                getInitials={getInitials}
              />
            )}
          </main>
        </>
      )}
    </>
  );

  // Render as modal or page
  if (isModal) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {content}
    </div>
  );
}

// Summary Tab Component
interface SummaryTabProps {
  meeting: Meeting;
  isGeneratingSummary?: boolean;
}

function SummaryTab({ meeting, isGeneratingSummary = false }: SummaryTabProps) {
  const summary = meeting.summaries?.[0]; // Latest summary

  return (
    <div className={styles.summaryTab}>
      {/* AI Summary Section */}
      {summary ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>AI Summary</h3>
            {summary.aiModel && (
              <span className={styles.aiModel}>Generated by {summary.aiModel}</span>
            )}
          </div>
          <div className={styles.summaryContent}>
            <p className={styles.summaryText}>{summary.summary}</p>
            
            {summary.keyPoints.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Key Points</h4>
                <ul className={styles.pointsList}>
                  {summary.keyPoints.map((point, index) => (
                    <li key={index} className={styles.pointItem}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.actionItems.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Action Items</h4>
                <ul className={styles.pointsList}>
                  {summary.actionItems.map((item, index) => (
                    <li key={index} className={styles.actionItem}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.decisions.length > 0 && (
              <div className={styles.summarySubsection}>
                <h4>Decisions Made</h4>
                <ul className={styles.pointsList}>
                  {summary.decisions.map((decision, index) => (
                    <li key={index} className={styles.decisionItem}>{decision}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : isGeneratingSummary ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>AI Summary</h3>
          <div className={styles.generatingSummary}>
            <div className={styles.loadingSpinner}></div>
            <h4>🤖 Generating AI Summary...</h4>
            <p>Our AI is analyzing the meeting transcript and creating a comprehensive summary. This usually takes 30-60 seconds.</p>
            <div className={styles.processingSteps}>
              <div className={styles.processingStep}>
                <span className={styles.stepIcon}>📝</span>
                <span>Analyzing transcript</span>
              </div>
              <div className={styles.processingStep}>
                <span className={styles.stepIcon}>🔍</span>
                <span>Extracting key points</span>
              </div>
              <div className={styles.processingStep}>
                <span className={styles.stepIcon}>✅</span>
                <span>Identifying action items</span>
              </div>
              <div className={styles.processingStep}>
                <span className={styles.stepIcon}>🎯</span>
                <span>Summarizing decisions</span>
              </div>
            </div>
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
        {transcripts.map((transcript, index) => (
          <div key={`${transcript.speaker}-${transcript.timestamp}-${index}`} className={styles.transcriptItem}>
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