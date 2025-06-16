'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTracks, useRoomContext, useChat, useDataChannel } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/transcription-service';
import ReactMarkdown from 'react-markdown';
import { useUser } from '@clerk/nextjs';

interface TranscriptTabProps {
  onTranscriptsChange?: (transcripts: Transcript[]) => void;
}

interface DisplayTranscript {
  speaker: string;
  text: string;
  participantId: string;
  timestamp: number;
  entryId: string;
}

interface SharedTranscript {
  id: string;
  speaker: string;
  text: string;
  participantId: string;
  timestamp: number;
  entryId: string;
  type: 'transcript' | 'transcript_update';
}

interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface GroupedChatMessage {
  senderId: string;
  senderName: string;
  messages: ChatMessage[];
  latestTimestamp: number;
  groupId: string;
}

type MainView = 'public' | 'private';
type PublicSubView = 'chat' | 'transcript';
type PrivateSubView = 'notes' | 'ohm';

export function TranscriptTab({ onTranscriptsChange }: TranscriptTabProps) {
  const { user } = useUser();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [sharedTranscripts, setSharedTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeView, setActiveView] = useState<MainView>('private');
  const [publicSubView, setPublicSubView] = useState<PublicSubView>('chat');
  const [privateSubView, setPrivateSubView] = useState<PrivateSubView>('notes');
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isExpanded, setIsExpanded] = useState(false);
  const room = useRoomContext();
  const tracks = useTracks();

  // Use ref to track current shared transcripts to avoid stale closures
  const sharedTranscriptsRef = React.useRef<DisplayTranscript[]>([]);
  
  // Update ref whenever sharedTranscripts changes
  React.useEffect(() => {
    sharedTranscriptsRef.current = sharedTranscripts;
  }, [sharedTranscripts]);

  // Regular Chat functionality (LiveKit)
  const { chatMessages, send: sendMessage, isSending } = useChat();
  const [chatInput, setChatInput] = useState('');
  const [groupedChatMessages, setGroupedChatMessages] = useState<GroupedChatMessage[]>([]);
  const chatMessagesRef = React.useRef<HTMLDivElement>(null);

  // AI Chat functionality (separate from regular chat)
  const [aiChatHistory, setAiChatHistory] = useState<Array<{
    id: string;
    type: 'user' | 'ai';
    message: string;
    timestamp: number;
    userName?: string;
    usedContext?: boolean;
    relevantTranscripts?: number;
    usedWebSearch?: boolean;
    citations?: string[];
  }>>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Question suggestions for AI chat
  const questionSuggestions = [
    "Summarize our room's previous discussions",
    "What are the recurring topics in our meetings?", 
    "Create a summary of action items",
    "What decisions were made recently"
  ];

  // Add transcript messages ref for auto-scrolling
  const transcriptMessagesRef = React.useRef<HTMLDivElement>(null);

  // Data channel for sharing transcripts
  const { send: sendData } = useDataChannel('transcript-sync');

  // Mobile responsive helpers
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Reset expanded state when switching between mobile/desktop
      if (!mobile) {
        setIsExpanded(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMobileHeaderClick = () => {
    if (isMobile) {
      setIsExpanded(!isExpanded);
    }
  };

  // Group chat messages by consecutive sender
  React.useEffect(() => {
    const grouped: GroupedChatMessage[] = [];
    
    chatMessages.forEach((message) => {
      const lastGroup = grouped[grouped.length - 1];
      const senderId = message.from?.identity || message.from?.name || 'Unknown';
      const senderName = message.from?.name || message.from?.identity || 'Unknown';
      
      // If last group is from the same sender, append to it
      if (lastGroup && lastGroup.senderId === senderId) {
        lastGroup.messages.push({
          id: message.id,
          text: message.message,
          timestamp: message.timestamp
        });
        // Update the group's latest timestamp
        lastGroup.latestTimestamp = Math.max(lastGroup.latestTimestamp, message.timestamp);
      } else {
        // Create new group for this sender
        grouped.push({
          senderId: senderId,
          senderName: senderName,
          messages: [{
            id: message.id,
            text: message.message,
            timestamp: message.timestamp
          }],
          latestTimestamp: message.timestamp,
          groupId: `${senderId}-${message.timestamp}-${Math.random()}`
        });
      }
    });
    
    setGroupedChatMessages(grouped);
  }, [chatMessages]);

  // Auto-scroll chat messages
  React.useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [groupedChatMessages, aiChatHistory, isAiProcessing]);

  // Auto-scroll transcript messages when new transcripts arrive
  React.useEffect(() => {
    if (transcriptMessagesRef.current) {
      transcriptMessagesRef.current.scrollTop = transcriptMessagesRef.current.scrollHeight;
    }
  }, [sharedTranscripts]);

  // Regular chat submit (LiveKit)
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    await sendMessage(chatInput);
    setChatInput('');
  };

  // AI chat submit (separate)
  const handleAiChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiChatInput.trim() || isAiProcessing) return;

    const messageText = aiChatInput.trim();
    
    // Process web search or send directly to AI
    let aiMessage = messageText;
    if (messageText.toLowerCase().startsWith('@web ')) {
      // Keep @web prefix for backend processing
      aiMessage = messageText;
    } else {
      // Send directly to AI without @ohm prefix
      aiMessage = messageText;
    }
    
    await handleAiChat(aiMessage);
    setAiChatInput('');
  };

  const handleAiChat = async (message: string) => {
    if (!message.trim() || isAiProcessing) return;

    const currentUser = room?.localParticipant?.name || room?.localParticipant?.identity || 'User';
    const roomName = room?.name || 'unknown';

    // Add user message to AI chat history
    const userChatId = `ai-user-${Date.now()}`;
    const userAiMessage = {
      id: userChatId,
      type: 'user' as const,
      message: message,
      timestamp: Date.now(),
      userName: currentUser,
    };

    setAiChatHistory(prev => [...prev, userAiMessage]);
    setIsAiProcessing(true);

    try {
      // Get current transcripts for context (from live meeting)
      const currentTranscripts = sharedTranscripts
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      console.log('🎙️ Sending current transcripts to AI:', currentTranscripts.length > 0 ? 'Yes' : 'No');
      console.log('📝 Current transcript sample:', currentTranscripts.substring(0, 200) + '...');

      // Send AI chat request
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          roomName,
          userName: currentUser,
          currentTranscripts,
          isLiveMeeting: true, // Important: Set this to true for live meetings
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add AI response to chat history
        const aiChatId = `ai-response-${Date.now()}`;
        const aiMessage = {
          id: aiChatId,
          type: 'ai' as const,
          message: data.response,
          timestamp: Date.now(),
          usedContext: data.usedContext,
          relevantTranscripts: data.relevantTranscripts,
          usedWebSearch: data.usedWebSearch,
          citations: data.citations,
        };

        setAiChatHistory(prev => [...prev, aiMessage]);
      } else {
        // Handle error
        const errorMessage = {
          id: `ai-error-${Date.now()}`,
          type: 'ai' as const,
          message: `Error: ${data.error || 'Failed to get AI response'}`,
          timestamp: Date.now(),
        };
        setAiChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending AI chat:', error);
      const errorMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai' as const,
        message: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setAiChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const transcriptionService = React.useMemo(() => new TranscriptionService(room), [room]);

  // Send transcript updates to other participants
  const shareTranscript = useCallback((transcript: Transcript) => {
    if (!room?.localParticipant || !sendData) return;

    const participantId = room.localParticipant.identity;
    const speaker = transcript.speaker || room.localParticipant.name || participantId;
    
    setSharedTranscripts(prev => {
      // Find the most recent entry (last in chronological order)
      const lastEntry = prev[prev.length - 1];
      
      // If the last entry is from the same participant, append to it
      // Otherwise, create a new entry
      if (lastEntry && lastEntry.participantId === participantId) {
        // Update the last entry by appending new text
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastEntry,
          text: lastEntry.text + ' ' + transcript.text,
          timestamp: Math.max(lastEntry.timestamp, transcript.timestamp)
        };
        return updated;
      } else {
        // Create new transcript entry for this participant
        const newTranscript = {
          speaker: speaker,
          text: transcript.text,
          participantId: participantId,
          timestamp: transcript.timestamp,
          entryId: `${participantId}-${Date.now()}-${Math.random()}`
        };
        return [...prev, newTranscript];
      }
    });
    
    // Get the updated transcript state to send
    setTimeout(() => {
      const currentTranscripts = sharedTranscriptsRef.current;
      const lastEntry = currentTranscripts[currentTranscripts.length - 1];
      
      if (lastEntry && lastEntry.participantId === participantId) {
        const sharedData: SharedTranscript = {
          id: `${participantId}-${Date.now()}`,
          speaker: speaker,
          text: lastEntry.text,
          participantId: participantId,
          timestamp: lastEntry.timestamp,
          entryId: lastEntry.entryId,
          type: 'transcript_update'
        };

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(sharedData));
        
        try {
          sendData(data, { reliable: true });
        } catch (error) {
          console.error('Error sending transcript data:', error);
        }
      }
    }, 0);
  }, [room, sendData]);

  // Listen for shared transcript data from other participants
  React.useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload)) as SharedTranscript;
        
        // Skip if this transcript is from the current user (prevents duplication)
        const currentUserId = room.localParticipant?.identity || room.localParticipant?.name || user?.id;
        if (data.participantId === currentUserId) {
          console.log('🔍 TRANSCRIPT DEBUG: Skipping own transcript from data channel to prevent duplication');
          return;
        }
        
        if (data.type === 'transcript' || data.type === 'transcript_update') {
          setSharedTranscripts(prev => {
            // Check if this is an update to an existing entry
            const existingIndex = prev.findIndex(t => t.entryId === data.entryId);
            
            if (existingIndex >= 0) {
              // Update existing entry
              const updated = [...prev];
              updated[existingIndex] = {
                speaker: data.speaker,
                text: data.text,
                participantId: data.participantId,
                timestamp: data.timestamp,
                entryId: data.entryId
              };
              return updated;
            } else {
              // Check if we should append to the last entry from this participant
              const lastEntry = prev[prev.length - 1];
              
              if (lastEntry && lastEntry.participantId === data.participantId && 
                  Math.abs(data.timestamp - lastEntry.timestamp) < 5000) { // Within 5 seconds
                // Update the last entry
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastEntry,
                  text: data.text,
                  entryId: data.entryId,
                  timestamp: Math.max(lastEntry.timestamp, data.timestamp)
                };
                return updated;
              } else {
                // Add new transcript entry in chronological order
                const newTranscript = {
                  speaker: data.speaker,
                  text: data.text,
                  participantId: data.participantId,
                  timestamp: data.timestamp,
                  entryId: data.entryId
                };
                return [...prev, newTranscript];
              }
            }
          });
        }
      } catch (error) {
        console.error('Error parsing shared transcript data:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, user?.id]);

  // Auto-start transcription when audio tracks are available
  const startTranscription = useCallback(async () => {
    if (isRecording) return;
    
    const audioTracks = tracks.filter(track => track.publication.source === Track.Source.Microphone);
    if (audioTracks.length === 0) return;

    try {
      setIsRecording(true);
      const track = audioTracks[0].publication?.track;
      if (!track) {
        setIsRecording(false);
        return;
      }

      console.log('🔍 TRANSCRIPTION DEBUG: Starting transcription service...');
      const audioTrack = track.mediaStreamTrack;
      await transcriptionService.startTranscription(audioTrack, (transcript: Transcript) => {
        console.log('🔍 TRANSCRIPTION DEBUG: Received transcript from service:', {
          speaker: transcript.speaker,
          text: transcript.text,
          timestamp: new Date(transcript.timestamp).toLocaleTimeString(),
          timestampRaw: transcript.timestamp
        });
        
        setTranscripts(prev => {
          const updated = [...prev, transcript];
          console.log('🔍 TRANSCRIPTION DEBUG: Updated local transcripts count:', updated.length);
          return updated;
        });
        
        shareTranscript(transcript); // Share with other participants
      });
      console.log('🔍 TRANSCRIPTION DEBUG: Transcription service started successfully');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setIsRecording(false);
    }
  }, [transcriptionService, isRecording, tracks, shareTranscript]);

  // Auto-start transcription when tracks become available
  useEffect(() => {
    const audioTracks = tracks.filter(track => track.publication.source === Track.Source.Microphone);
    if (audioTracks.length > 0 && !isRecording) {
      startTranscription();
    }
  }, [tracks, startTranscription, isRecording]);

  // Load notes on mount
  useEffect(() => {
    if (!user || !room?.name) return;
    
    // Use consistent storage key format: meeting-notes-${roomName}-${userId}
    const storageKey = `meeting-notes-${room.name}-${user.id}`;
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [user, room?.name]);

  // Notify parent component when transcripts change
  useEffect(() => {
    if (onTranscriptsChange) {
      // Combine local transcripts and shared transcripts
      const allTranscripts: Transcript[] = [
        ...transcripts,
        ...sharedTranscripts.map(st => ({
          speaker: st.speaker,
          text: st.text,
          timestamp: st.timestamp
        }))
      ];
      
      // Sort by timestamp
      allTranscripts.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('🔍 CALLBACK DEBUG: Sending combined transcripts to parent:', {
        localCount: transcripts.length,
        sharedCount: sharedTranscripts.length,
        totalCount: allTranscripts.length,
        transcripts: allTranscripts.map((t, i) => ({
          index: i,
          speaker: t.speaker,
          text: t.text.substring(0, 50) + (t.text.length > 50 ? '...' : ''),
          timestamp: new Date(t.timestamp).toLocaleTimeString(),
          source: i < transcripts.length ? 'local' : 'shared'
        }))
      });
      
      onTranscriptsChange(allTranscripts);
    }
  }, [transcripts, sharedTranscripts, onTranscriptsChange]);

  // Auto-save notes
  useEffect(() => {
    if (!notes || !user || !room?.name) return;

    setSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      // Use consistent storage key format: meeting-notes-${roomName}-${userId}
      const storageKey = `meeting-notes-${room.name}-${user.id}`;
      localStorage.setItem(storageKey, notes);
      setSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, user, room?.name]);

  const exportNotes = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const content = `Ohm Meeting Notes - ${room?.name}\nDate: ${timestamp}\n\n${notes}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ohm-notes-${room?.name}-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearNotes = () => {
    if (confirm('Are you sure you want to clear all notes?')) {
      setNotes('');
      if (user && room?.name) {
        // Use consistent storage key format: meeting-notes-${roomName}-${userId}
        const storageKey = `meeting-notes-${room.name}-${user.id}`;
        localStorage.removeItem(storageKey);
      }
    }
  };

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

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`meeting-assistant ${isMobile && isExpanded ? 'expanded' : ''}`}>
      <div className="meeting-assistant-header" onClick={handleMobileHeaderClick}>
        <h3 className="meeting-assistant-title">
          🤖 Meeting Assistant
          {isMobile && (
            <span className="expand-indicator">
              {isExpanded ? '▼' : '▲'}
            </span>
          )}
        </h3>
        
        {/* Main View Toggle - More compact design */}
        <div className="main-view-toggle compact">
          <button 
            className={`view-toggle-button compact ${activeView === 'private' ? 'view-toggle-button--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) {
                if (activeView === 'private' && isExpanded) {
                  setIsExpanded(false);
                } else {
                  setActiveView('private');
                  setIsExpanded(true);
                }
              } else {
                setActiveView('private');
              }
            }}
          >
            🔒 Private
            {(aiChatHistory.length > 0 || notes.trim()) && (
              <span className="notification-dot"></span>
            )}
          </button>
          <button 
            className={`view-toggle-button compact ${activeView === 'public' ? 'view-toggle-button--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) {
                if (activeView === 'public' && isExpanded) {
                  setIsExpanded(false);
                } else {
                  setActiveView('public');
                  setIsExpanded(true);
                }
              } else {
                setActiveView('public');
              }
            }}
          >
            👥 Public
            {(chatMessages.length > 0 || sharedTranscripts.length > 0) && (
              <span className="notification-dot"></span>
            )}
          </button>
        </div>
      </div>

      <div className="meeting-assistant-content">
        {activeView === 'public' && (
          <div className="public-view">
            {/* Sub-tabs for public content */}
            <div className="sub-tab-container">
              <button 
                className={`sub-tab-button ${publicSubView === 'chat' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPublicSubView('chat')}
              >
                💬 Chat
                {chatMessages.length > 0 && (
                  <span className="chat-badge">{chatMessages.length}</span>
                )}
              </button>
              <button 
                className={`sub-tab-button ${publicSubView === 'transcript' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPublicSubView('transcript')}
              >
                📝 Transcript
                {isRecording && (
                  <span className="recording-dot"></span>
                )}
              </button>
            </div>

            {publicSubView === 'chat' && (
              <div className="public-chat-tab">
                <div className="chat-messages" ref={chatMessagesRef}>
                  {groupedChatMessages.length === 0 ? (
                    <div className="chat-empty">
                      <div className="empty-icon">💬</div>
                      <p>No messages yet. Start a conversation with other participants!</p>
                    </div>
                  ) : (
                    groupedChatMessages.map((group) => (
                      <div key={group.groupId} className="chat-message-group">
                        <div className="chat-message-header">
                          <span className="chat-sender">
                            👤 {group.senderName}
                          </span>
                          <span className="chat-timestamp">
                            {formatTimestamp(group.latestTimestamp)}
                          </span>
                        </div>
                        <div className="chat-message-text">
                          {group.messages.map((msg) => (
                            <div key={msg.id} className="chat-message">
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <form className="chat-input-form" onSubmit={handleChatSubmit}>
                  <div className="chat-input-row">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="💬 Message to participants..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isSending}
                    />
                    <button 
                      type="submit" 
                      className="chat-send-button"
                      disabled={isSending || !chatInput.trim()}
                      title="Send message"
                    >
                      {isSending ? '⏳' : '📤'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {publicSubView === 'transcript' && (
              <div className="transcript-tab">
                <div className="transcript-controls">
                  {isRecording && (
                    <div className="recording-indicator">
                      <div className="recording-pulse"></div>
                      <span className="recording-text">🔴 Recording</span>
                    </div>
                  )}
                </div>
                
                <div className="transcript-messages" ref={transcriptMessagesRef}>
                  {sharedTranscripts.length === 0 ? (
                    <div className="transcript-empty">
                      <div className="empty-icon">🎙️</div>
                      <p>Transcription will appear here once the meeting starts</p>
                    </div>
                  ) : (
                    sharedTranscripts.map((transcript) => (
                      <div key={transcript.entryId} className="transcript-message">
                        <div className={`speaker-badge ${getSpeakerColor(transcript.speaker)}`}>
                          🎤 {transcript.speaker}
                        </div>
                        <p className="transcript-text">{transcript.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'private' && (
          <div className="private-view">
            {/* Sub-tabs for private content */}
            <div className="sub-tab-container">
              <button 
                className={`sub-tab-button ${privateSubView === 'notes' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPrivateSubView('notes')}
              >
                📋 Notes
                {notes.trim() && (
                  <span className="notification-dot"></span>
                )}
              </button>
              <button 
                className={`sub-tab-button ${privateSubView === 'ohm' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPrivateSubView('ohm')}
              >
                🤖 Ohm AI
                {aiChatHistory.length > 0 && (
                  <span className="chat-badge">{aiChatHistory.length}</span>
                )}
              </button>
            </div>

            {privateSubView === 'notes' && (
              <div className="notes-tab">
                <div className="notes-header">
                  <div className="notes-actions">
                    <button onClick={exportNotes} className="action-button" disabled={!notes.trim()} title="Export notes">
                      📥 Export
                    </button>
                    <button onClick={clearNotes} className="action-button action-button--danger" disabled={!notes.trim()} title="Clear all notes">
                      🗑️ Clear
                    </button>
                  </div>
                  <div className="save-status">
                    <span className={`save-indicator save-indicator--${saveStatus}`}>
                      {saveStatus === 'saved' && '✅ Saved'}
                      {saveStatus === 'saving' && '⏳ Saving...'}
                      {saveStatus === 'unsaved' && '⚠️ Unsaved'}
                    </span>
                  </div>
                </div>
                <textarea
                  className="notes-textarea"
                  placeholder="📝 Take notes during the meeting..."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setSaveStatus('unsaved');
                  }}
                />
                <div className="notes-footer">
                  <span className="character-count">📊 {notes.length} characters</span>
                </div>
              </div>
            )}

            {privateSubView === 'ohm' && (
              <div className="ai-chat-tab">
                <div className="chat-messages" ref={chatMessagesRef}>
                  {aiChatHistory.length === 0 ? (
                    <div className="chat-empty">
                      <div className="empty-icon">🤖</div>
                      <p>Ask Ohm about the meeting, participants, or search the web!</p>
                      
                      <div className="ai-suggestions" style={{ marginTop: '0.75rem' }}>
                        <p className="suggestions-title">💡 Try asking Ohm:</p>
                        <div className="suggestion-buttons">
                          {questionSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              className="suggestion-button"
                              onClick={async () => {
                                if (suggestion.startsWith('@web')) {
                                  await handleAiChat(suggestion);
                                } else {
                                  await handleAiChat(suggestion);
                                }
                              }}
                              disabled={isAiProcessing}
                            >
                              {index === 0 && '📊'} {index === 1 && '🔄'} {index === 2 && '✅'} {index === 3 && '🎯'} {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Show suggestions at the top for any chat activity */}
                      <div className="ai-suggestions-compact">
                        <p className="suggestions-title-compact">💡 Ask Ohm AI:</p>
                        <div className="suggestion-buttons-compact">
                          {questionSuggestions.slice(0, 3).map((suggestion, index) => (
                            <button
                              key={index}
                              className="suggestion-button-compact"
                              onClick={async () => {
                                if (suggestion.startsWith('@web')) {
                                  await handleAiChat(suggestion);
                                } else {
                                  await handleAiChat(suggestion);
                                }
                              }}
                              disabled={isAiProcessing}
                            >
                              {index === 0 && '📊'} {index === 1 && '🔄'} {index === 2 && '✅'} {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* AI Chat Messages */}
                      {aiChatHistory.map((aiMsg) => (
                        <div key={aiMsg.id} className={`chat-message-group ${aiMsg.type === 'ai' ? 'ai-message' : 'user-ai-message'}`}>
                          <div className="chat-message-header">
                            <span className="chat-sender">
                              {aiMsg.type === 'ai' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  Ohm AI
                                  {aiMsg.usedWebSearch && (
                                    <span style={{ 
                                      fontSize: '0.625rem', 
                                      background: '#4ade80', 
                                      color: 'white',
                                      padding: '0.125rem 0.25rem',
                                      borderRadius: '4px'
                                    }}>
                                      🌐 web
                                    </span>
                                  )}
                                  {aiMsg.usedContext && (
                                    <span style={{ 
                                      fontSize: '0.625rem', 
                                      background: 'var(--lk-accent-bg)', 
                                      color: 'var(--lk-accent-fg)',
                                      padding: '0.125rem 0.25rem',
                                      borderRadius: '4px'
                                    }}>
                                      📄 {aiMsg.relevantTranscripts ? `${aiMsg.relevantTranscripts} refs` : 'context'}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                `👤 ${aiMsg.userName} → AI`
                              )}
                            </span>
                            <span className="chat-timestamp">
                              {formatTimestamp(aiMsg.timestamp)}
                            </span>
                          </div>
                          <div className="chat-message-text">
                            <div className="chat-message">
                              <ReactMarkdown>{aiMsg.message}</ReactMarkdown>
                            </div>
                            {aiMsg.citations && aiMsg.citations.length > 0 && (
                              <div className="message-citations">
                                <div className="citations-label">🔗 Sources:</div>
                                <div className="citations-list">
                                  {aiMsg.citations.map((url, index) => (
                                    <a 
                                      key={index}
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="citation-link"
                                    >
                                      🌐 {new URL(url).hostname}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* AI Processing Indicator */}
                      {isAiProcessing && (
                        <div className="chat-message-group ai-message">
                          <div className="chat-message-header">
                            <span className="chat-sender">Ohm AI</span>
                            <span className="chat-timestamp">⏳ Processing...</span>
                          </div>
                          <div className="chat-message-text">
                            <div className="chat-message ai-processing">
                              <span className="ai-typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                              </span>
                              🧠 Thinking...
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <form className="chat-input-form" onSubmit={handleAiChatSubmit}>
                  <div className="ai-command-buttons compact">
                    <button
                      type="button"
                      className={`command-button compact ${aiChatInput.toLowerCase().startsWith('@web ') ? 'active' : ''}`}
                      onClick={() => {
                        if (aiChatInput.toLowerCase().startsWith('@web ')) {
                          // Remove @web prefix
                          setAiChatInput(aiChatInput.slice(5));
                        } else {
                          // Add @web prefix
                          setAiChatInput(`@web ${aiChatInput}`);
                        }
                      }}
                      disabled={isAiProcessing}
                      title="Web Search"
                    >
                      🌐
                    </button>
                  </div>
                  <div className="chat-input-row">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder={aiChatInput.toLowerCase().startsWith('@web ') ? "🔍 Search the web..." : "🤖 Ask Ohm about the meeting..."}
                      value={aiChatInput}
                      onChange={(e) => setAiChatInput(e.target.value)}
                      disabled={isAiProcessing}
                    />
                    <button 
                      type="submit" 
                      className="chat-send-button"
                      disabled={isAiProcessing || !aiChatInput.trim()}
                      title="Send to AI"
                    >
                      {isAiProcessing ? '⏳' : '🚀'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 