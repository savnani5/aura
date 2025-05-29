'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTracks, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/transcription-service';

interface TranscriptTabProps {
  onMeetingEnd?: (transcripts: Transcript[]) => void;
}

interface DisplayTranscript {
  speaker: string;
  text: string;
}

type TabView = 'transcript' | 'notepad';

export function TranscriptTab({ onMeetingEnd }: TranscriptTabProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [displayTranscripts, setDisplayTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('transcript');
  const [notes, setNotes] = useState('');
  const room = useRoomContext();
  const tracks = useTracks();
  const transcriptionService = React.useMemo(() => new TranscriptionService(room), [room]);

  // Load notes from localStorage on component mount
  useEffect(() => {
    const participantId = room?.localParticipant?.identity || 'unknown';
    const roomName = room?.name || 'unknown-room';
    const notesKey = `meeting-notes-${roomName}-${participantId}`;
    const savedNotes = localStorage.getItem(notesKey);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [room]);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    const participantId = room?.localParticipant?.identity || 'unknown';
    const roomName = room?.name || 'unknown-room';
    const notesKey = `meeting-notes-${roomName}-${participantId}`;
    localStorage.setItem(notesKey, notes);
  }, [notes, room]);

  // Filter audio tracks
  const audioTracks = tracks.filter(
    (track) => track.source === Track.Source.Microphone && track.participant.identity !== 'recorder'
  );

  const startTranscription = useCallback(async () => {
    if (audioTracks.length === 0) {
      console.error('No audio tracks available');
      return;
    }

    const track = audioTracks[0].publication?.track;
    if (!track) {
      console.error('No track available');
      return;
    }

    setIsRecording(true);
    const audioTrack = track.mediaStreamTrack;
    await transcriptionService.startTranscription(audioTrack, (transcript) => {
      setTranscripts((prev) => {
        const newTranscripts = [...prev, transcript];
        // Sort transcripts by timestamp
        return newTranscripts.sort((a, b) => a.timestamp - b.timestamp);
      });
    });
  }, [audioTracks, transcriptionService]);

  // Auto-start transcription when audio tracks become available
  useEffect(() => {
    if (audioTracks.length > 0 && !isRecording) {
      startTranscription();
    }
  }, [audioTracks, isRecording, startTranscription]);

  // Process transcripts to combine consecutive messages from the same speaker
  useEffect(() => {
    const processed: DisplayTranscript[] = [];
    let currentSpeaker = '';
    let currentText = '';

    transcripts.forEach((transcript) => {
      if (transcript.speaker !== currentSpeaker) {
        // If we have accumulated text, add it to processed
        if (currentText) {
          processed.push({
            speaker: currentSpeaker,
            text: currentText.trim()
          });
        }
        // Start new speaker
        currentSpeaker = transcript.speaker;
        currentText = transcript.text;
      } else {
        // Append to current speaker's text
        currentText += ' ' + transcript.text;
      }
    });

    // Add the last message
    if (currentText) {
      processed.push({
        speaker: currentSpeaker,
        text: currentText.trim()
      });
    }

    setDisplayTranscripts(processed);
  }, [transcripts]);

  useEffect(() => {
    if (!room) return;

    // Handle room disconnection for meeting end
    const handleDisconnected = () => {
      if (onMeetingEnd) {
        onMeetingEnd(transcripts);
      }
    };

    // Handle incoming transcripts from other participants
    const handleData = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(payload);
        
        if (!jsonString) {
          console.warn('Received empty payload');
          return;
        }

        const transcript = JSON.parse(jsonString) as Transcript;
        
        // Validate transcript structure
        if (!transcript.speaker || !transcript.text || typeof transcript.timestamp !== 'number') {
          console.warn('Received invalid transcript structure:', transcript);
          return;
        }

        setTranscripts((prev) => {
          const newTranscripts = [...prev, transcript];
          // Sort transcripts by timestamp
          return newTranscripts.sort((a, b) => a.timestamp - b.timestamp);
        });
      } catch (error) {
        console.error('Error parsing transcript:', error);
      }
    };

    room.on('disconnected', handleDisconnected);
    room.on('dataReceived', handleData);

    return () => {
      room.off('disconnected', handleDisconnected);
      room.off('dataReceived', handleData);
    };
  }, [room, transcripts, onMeetingEnd]);

  // Generate speaker colors for consistency
  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200', 
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200'
    ];
    const hash = speaker.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };

  const clearNotes = () => {
    setNotes('');
  };

  const exportNotes = () => {
    const participantName = room?.localParticipant?.name || room?.localParticipant?.identity || 'Unknown';
    const roomName = room?.name || 'Unknown Room';
    const timestamp = new Date().toLocaleString();
    
    const content = `Meeting Notes - ${roomName}\nParticipant: ${participantName}\nDate: ${timestamp}\n\n${notes}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${roomName}-${timestamp.replace(/[/:]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transcript-container">
      {/* Header with Tab Toggle */}
      <div className="transcript-header">
        <div className="flex items-center gap-3 mb-4">
          <div className="transcript-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1L21 5V11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5L12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="transcript-title">Meeting Assistant</h3>
        </div>

        {/* Tab Toggle */}
        <div className="tab-toggle">
          <button
            className={`tab-button ${activeTab === 'notepad' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('notepad')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Notes
          </button>
          <button
            className={`tab-button ${activeTab === 'transcript' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Transcript
          </button>
        </div>
        
        {/* Auto Recording Indicator - Only show on transcript tab when recording */}
        {activeTab === 'transcript' && isRecording && (
          <div className="recording-indicator">
            <div className="recording-pulse"></div>
            <span className="recording-text">Recording...</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="transcript-content">
        {activeTab === 'transcript' ? (
          // Transcript View
          displayTranscripts.length === 0 ? (
            <div className="transcript-empty">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="empty-text">
                {isRecording ? 'Listening for speech...' : 'Waiting for audio to start transcription...'}
              </p>
            </div>
          ) : (
            <div className="transcript-messages">
              {displayTranscripts.map((transcript, index) => (
                <div key={index} className="message-block">
                  <div className={`speaker-badge ${getSpeakerColor(transcript.speaker)}`}>
                    <div className="speaker-avatar">
                      {transcript.speaker.charAt(0).toUpperCase()}
                    </div>
                    <span className="speaker-name">{transcript.speaker}</span>
                  </div>
                  <div className="message-content">
                    <p className="message-text">{transcript.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Notepad View
          <div className="notepad-container">
            <div className="notepad-header">
              <div className="notepad-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Personal Notes
              </div>
              <div className="notepad-actions">
                <button onClick={clearNotes} className="notepad-action-btn" title="Clear notes">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
                <button onClick={exportNotes} className="notepad-action-btn" title="Export notes">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
            </div>
            <textarea
              className="notepad-textarea"
              value={notes}
              onChange={handleNotesChange}
              placeholder="Type your meeting notes here..."
              spellCheck={true}
            />
            <div className="notepad-footer">
              <span className="character-count">{notes.length} characters</span>
              <span className="save-indicator">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="7,3 7,8 15,8" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Auto-saved
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 