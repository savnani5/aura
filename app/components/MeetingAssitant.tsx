'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTracks, useRoomContext, useChat, useDataChannel } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/transcription-service';
import ReactMarkdown from 'react-markdown';

interface TranscriptTabProps {
  onMeetingEnd?: (transcripts: Transcript[]) => void;
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

type TabView = 'notes' | 'transcript' | 'chat';

export function TranscriptTab({ onMeetingEnd }: TranscriptTabProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [sharedTranscripts, setSharedTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('notes');
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

  // Chat functionality
  const { chatMessages, send: sendMessage, isSending } = useChat();
  const [chatInput, setChatInput] = useState('');
  const [groupedChatMessages, setGroupedChatMessages] = useState<GroupedChatMessage[]>([]);
  const chatMessagesRef = React.useRef<HTMLDivElement>(null);

  // AI Chat functionality
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
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Question suggestions for AI chat
  const questionSuggestions = [
    "Summarize what's been decided so far?",
    "What are the action items from last meeting?",
    "What are the key topics covered in this meeting?",
    "What questions were raised but not answered?",
    "@web Latest industry trends and news"
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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    const message = chatInput.trim();
    const isAiCommand = message.toLowerCase().startsWith('@ohm ') || message.toLowerCase().startsWith('@web ');

    if (isAiCommand) {
      // Handle AI command - remove the @ohm or @web prefix (case-insensitive)
      let aiMessage = message;
      if (message.toLowerCase().startsWith('@ohm ')) {
        aiMessage = message.slice(message.toLowerCase().indexOf('@ohm ') + 5);
      } else if (message.toLowerCase().startsWith('@web ')) {
        aiMessage = message; // Keep @web prefix for backend processing
      }
      await handleAiChat(aiMessage);
    } else {
      // Handle regular chat
      await sendMessage(chatInput);
    }
    
    setChatInput('');
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
      // Get current transcripts for context
      const currentTranscripts = sharedTranscripts
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

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

  // Store transcripts for AI context periodically
  React.useEffect(() => {
    if (sharedTranscripts.length === 0) return;

    const storeTranscripts = async () => {
      const transcriptText = sharedTranscripts
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      const participants = Array.from(new Set(sharedTranscripts.map(t => t.speaker)));
      const roomName = room?.name || 'unknown';

      try {
        await fetch('/api/ai-chat', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName,
            transcriptText,
            participants,
          }),
        });
      } catch (error) {
        console.error('Error storing transcript for AI:', error);
      }
    };

    // Store transcripts every 30 seconds if there are new ones
    const interval = setInterval(storeTranscripts, 30000);
    return () => clearInterval(interval);
  }, [sharedTranscripts, room?.name]);

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
  }, [room]);

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

      const audioTrack = track.mediaStreamTrack;
      await transcriptionService.startTranscription(audioTrack, (transcript: Transcript) => {
        setTranscripts(prev => [...prev, transcript]);
        shareTranscript(transcript); // Share with other participants
      });
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

  // Notes persistence
  const roomName = room?.name || 'unknown';
  const participantId = room?.localParticipant?.identity || 'unknown';

  // Load notes on mount
  useEffect(() => {
    const storageKey = `meeting-notes-${roomName}-${participantId}`;
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [roomName, participantId]);

  // Auto-save notes
  useEffect(() => {
    if (!notes) return;

    setSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      const storageKey = `meeting-notes-${roomName}-${participantId}`;
      localStorage.setItem(storageKey, notes);
      setSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, roomName, participantId]);

  const exportNotes = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const content = `Ohm Meeting Notes - ${roomName}\nDate: ${timestamp}\n\n${notes}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ohm-notes-${roomName}-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearNotes = () => {
    if (confirm('Are you sure you want to clear all notes?')) {
      setNotes('');
      const storageKey = `meeting-notes-${roomName}-${participantId}`;
      localStorage.removeItem(storageKey);
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
          Meeting Assistant
          {isMobile && (
            <span className="expand-indicator">
              {isExpanded ? '▼' : '▲'}
            </span>
          )}
        </h3>
        <div className="tab-container">
          <button 
            className={`tab-button ${activeTab === 'notes' ? 'tab-button--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) {
                // If clicking the active tab and expanded, collapse it
                if (activeTab === 'notes' && isExpanded) {
                  setIsExpanded(false);
                } else {
                  setActiveTab('notes');
                  setIsExpanded(true);
                }
              } else {
                setActiveTab('notes');
              }
            }}
          >
            Notes
          </button>
          <button 
            className={`tab-button ${activeTab === 'transcript' ? 'tab-button--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) {
                // If clicking the active tab and expanded, collapse it
                if (activeTab === 'transcript' && isExpanded) {
                  setIsExpanded(false);
                } else {
                  setActiveTab('transcript');
                  setIsExpanded(true);
                }
              } else {
                setActiveTab('transcript');
              }
            }}
          >
            Transcript
          </button>
          <button 
            className={`tab-button ${activeTab === 'chat' ? 'tab-button--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) {
                // If clicking the active tab and expanded, collapse it
                if (activeTab === 'chat' && isExpanded) {
                  setIsExpanded(false);
                } else {
                  setActiveTab('chat');
                  setIsExpanded(true);
                }
              } else {
                setActiveTab('chat');
              }
            }}
          >
            Ohm
            {chatMessages.length > 0 && (
              <span className="chat-badge">{chatMessages.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="meeting-assistant-content">
        {activeTab === 'notes' && (
          <div className="notes-tab">
            <div className="notes-header">
              <div className="notes-actions">
                <button onClick={exportNotes} className="action-button" disabled={!notes.trim()}>
                  Export
                </button>
                <button onClick={clearNotes} className="action-button action-button--danger" disabled={!notes.trim()}>
                  Clear
                </button>
              </div>
              <div className="save-status">
                <span className={`save-indicator save-indicator--${saveStatus}`}>
                  {saveStatus === 'saved' && '✓ Saved'}
                  {saveStatus === 'saving' && '⏳ Saving...'}
                  {saveStatus === 'unsaved' && '● Unsaved'}
                </span>
              </div>
            </div>
            <textarea
              className="notes-textarea"
              placeholder="Take notes during the meeting..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaveStatus('unsaved');
              }}
            />
            <div className="notes-footer">
              <span className="character-count">{notes.length} characters</span>
            </div>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="transcript-tab">
            <div className="transcript-controls">
              {isRecording && (
                <div className="recording-indicator">
                  <div className="recording-pulse"></div>
                  <span className="recording-text">Recording</span>
                </div>
              )}
            </div>
            
            <div className="transcript-messages" ref={transcriptMessagesRef}>
              {sharedTranscripts.length === 0 ? (
                <div className="transcript-empty">
                  <p>Transcription will appear here once the meeting starts</p>
                </div>
              ) : (
                sharedTranscripts.map((transcript) => (
                  <div key={transcript.entryId} className="transcript-message">
                    <div className={`speaker-badge ${getSpeakerColor(transcript.speaker)}`}>
                      {transcript.speaker}
                    </div>
                    <p className="transcript-text">{transcript.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-tab">
            <div className="chat-messages" ref={chatMessagesRef}>
              {groupedChatMessages.length === 0 && aiChatHistory.length === 0 ? (
                <div className="chat-empty">
                  <p>No messages yet. Start a conversation!</p>
                  <p className="chat-tip">
                    💡 Tip: Use <strong>@ohm</strong> for AI assistant, <strong>@web</strong> for web search
                  </p>
                  
                  <div className="ai-suggestions">
                    <p className="suggestions-title">Try asking Ohm:</p>
                    <div className="suggestion-buttons">
                      {questionSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="suggestion-button"
                          onClick={async () => {
                            if (suggestion.startsWith('@web')) {
                              await handleAiChat(suggestion);
                            } else {
                              await handleAiChat(`@ohm ${suggestion}`);
                            }
                          }}
                          disabled={isSending || isAiProcessing}
                        >
                          {suggestion}
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
                      {questionSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="suggestion-button-compact"
                          onClick={async () => {
                            if (suggestion.startsWith('@web')) {
                              await handleAiChat(suggestion);
                            } else {
                              await handleAiChat(`@ohm ${suggestion}`);
                            }
                          }}
                          disabled={isSending || isAiProcessing}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Regular Chat Messages */}
                  {groupedChatMessages.map((group) => (
                    <div key={group.groupId} className="chat-message-group">
                      <div className="chat-message-header">
                        <span className="chat-sender">
                          {group.senderName}
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
                  ))}

                  {/* AI Chat Messages */}
                  {aiChatHistory.map((aiMsg) => (
                    <div key={aiMsg.id} className={`chat-message-group ${aiMsg.type === 'ai' ? 'ai-message' : 'user-ai-message'}`}>
                      <div className="chat-message-header">
                        <span className="chat-sender">
                          {aiMsg.type === 'ai' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              🤖 Ohm AI
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
                                  {aiMsg.relevantTranscripts ? `${aiMsg.relevantTranscripts} refs` : 'context'}
                                </span>
                              )}
                            </span>
                          ) : (
                            `${aiMsg.userName} → 🤖 AI`
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
                            <div className="citations-label">Sources:</div>
                            <div className="citations-list">
                              {aiMsg.citations.map((url, index) => (
                                <a 
                                  key={index}
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="citation-link"
                                >
                                  🔗 {new URL(url).hostname}
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
                        <span className="chat-sender">🤖 Ohm AI</span>
                        <span className="chat-timestamp">Processing...</span>
                      </div>
                      <div className="chat-message-text">
                        <div className="chat-message ai-processing">
                          <span className="ai-typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </span>
                          Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <form className="chat-input-form" onSubmit={handleChatSubmit}>
              <div className="chat-command-buttons">
                <button
                  type="button"
                  className={`command-button ${chatInput.toLowerCase().startsWith('@ohm ') ? 'active' : ''}`}
                  onClick={() => {
                    if (chatInput.toLowerCase().startsWith('@ohm ')) {
                      // Remove @ohm prefix if already present
                      setChatInput(chatInput.slice(5));
                    } else if (chatInput.toLowerCase().startsWith('@web ')) {
                      // Replace @web with @ohm
                      setChatInput(`@ohm ${chatInput.slice(5)}`);
                    } else {
                      // Add @ohm prefix
                      setChatInput(`@ohm ${chatInput}`);
                    }
                  }}
                  disabled={isSending || isAiProcessing}
                  title="AI Assistant"
                >
                  🤖 AI
                </button>
                <button
                  type="button"
                  className={`command-button ${chatInput.toLowerCase().startsWith('@web ') ? 'active' : ''}`}
                  onClick={() => {
                    if (chatInput.toLowerCase().startsWith('@web ')) {
                      // Remove @web prefix if already present
                      setChatInput(chatInput.slice(5));
                    } else if (chatInput.toLowerCase().startsWith('@ohm ')) {
                      // Replace @ohm with @web
                      setChatInput(`@web ${chatInput.slice(5)}`);
                    } else {
                      // Add @web prefix
                      setChatInput(`@web ${chatInput}`);
                    }
                  }}
                  disabled={isSending || isAiProcessing}
                  title="Web Search"
                >
                  🌐 Web
                </button>
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  className="chat-input"
                  placeholder={chatInput.toLowerCase().startsWith('@ohm ') || chatInput.toLowerCase().startsWith('@web ') ? "Ask AI about the meeting or search the web..." : "Type a message ..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSending || isAiProcessing}
                />
                <button 
                  type="submit" 
                  className="chat-send-button"
                  disabled={isSending || isAiProcessing || !chatInput.trim()}
                >
                  {chatInput.toLowerCase().startsWith('@ohm ') || chatInput.toLowerCase().startsWith('@web ') ? '🤖' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
} 