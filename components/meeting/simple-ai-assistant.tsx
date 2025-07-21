'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTracks, useRoomContext, useDataChannel } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/services/transcription';
import ReactMarkdown from 'react-markdown';
import { useUser } from '@clerk/nextjs';
import { MeetingStorageUtils, useMeetingStore } from '@/lib/state';

interface SimpleAIAssistantProps {
  onTranscriptsChange?: (transcripts: Transcript[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface DisplayTranscript {
  speaker: string;
  text: string;
  participantId: string;
  timestamp: number;
  entryId: string;
  isLocal?: boolean;
  speakerConfidence?: number;
  deepgramSpeaker?: number;
}

interface SharedTranscript {
  id: string;
  speaker: string;
  text: string;
  participantId: string;
  timestamp: number;
  entryId: string;
  type: 'transcript' | 'transcript_update';
  isLocal?: boolean;
  speakerConfidence?: number;
  deepgramSpeaker?: number;
}

export function SimpleAIAssistant({ onTranscriptsChange, isOpen, onClose }: SimpleAIAssistantProps) {
  const { user } = useUser();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [sharedTranscripts, setSharedTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const room = useRoomContext();
  const tracks = useTracks();

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
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // Refs for auto-scrolling (allow user control during streaming)
  const chatMessagesRef = React.useRef<HTMLDivElement>(null);
  const transcriptMessagesRef = React.useRef<HTMLDivElement>(null);
  const sharedTranscriptsRef = React.useRef<DisplayTranscript[]>([]);
  const [userScrolling, setUserScrolling] = useState(false);

  // Update ref whenever sharedTranscripts changes
  React.useEffect(() => {
    sharedTranscriptsRef.current = sharedTranscripts;
  }, [sharedTranscripts]);

  // Question suggestions for AI chat (simplified)
  const questionSuggestions = [
    "Summarize our discussions",
    "What are the key decisions?", 
    "List action items",
    "Show recent topics"
  ];

  // Browser compatibility check (simplified)
  React.useEffect(() => {
    const browserSupport = TranscriptionService.getBrowserSupport();
    if (!browserSupport.supported) {
      console.warn('Transcription not supported in this browser');
    }
  }, []);

  // Handle user scrolling to prevent auto-scroll interference
  const handleScroll = useCallback(() => {
    if (chatMessagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setUserScrolling(!isAtBottom);
    }
  }, []);

  // Auto-scroll chat messages only if user isn't scrolling
  React.useEffect(() => {
    if (chatMessagesRef.current && !userScrolling && !isAiProcessing) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [aiChatHistory, userScrolling, isAiProcessing]);

  // Auto-scroll transcript messages when new transcripts arrive
  useEffect(() => {
    if (transcriptMessagesRef.current && sharedTranscripts.length > 0) {
      setTimeout(() => {
        if (transcriptMessagesRef.current) {
          transcriptMessagesRef.current.scrollTop = transcriptMessagesRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [sharedTranscripts.length]);

  // Data channel for sharing transcripts
  const { send: sendData } = useDataChannel('transcript-sync');

  // Generate speaker colors for consistency
  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-slate-100 text-slate-800 border-slate-200',
      'bg-gray-100 text-gray-800 border-gray-200', 
      'bg-zinc-100 text-zinc-800 border-zinc-200',
      'bg-neutral-100 text-neutral-800 border-neutral-200',
      'bg-stone-100 text-stone-800 border-stone-200',
      'bg-slate-200 text-slate-900 border-slate-300'
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Group consecutive transcripts from the same speaker
  const groupedTranscripts = React.useMemo(() => {
    const groups: Array<{
      speaker: string;
      participantId: string;
      startTime: number;
      endTime: number;
      messages: DisplayTranscript[];
      speakerColor: string;
      speakerConfidence?: number;
      deepgramSpeaker?: number;
    }> = [];

    sharedTranscripts.forEach((transcript) => {
      const lastGroup = groups[groups.length - 1];
      
      const shouldGroup = lastGroup && 
        lastGroup.speaker === transcript.speaker &&
        lastGroup.participantId === transcript.participantId &&
        (transcript.timestamp - lastGroup.endTime) < 30000;
      
      if (shouldGroup) {
        lastGroup.messages.push(transcript);
        lastGroup.endTime = transcript.timestamp;
        if (transcript.speakerConfidence !== undefined) {
          lastGroup.speakerConfidence = transcript.speakerConfidence;
        }
        if (transcript.deepgramSpeaker !== undefined) {
          lastGroup.deepgramSpeaker = transcript.deepgramSpeaker;
        }
      } else {
        groups.push({
          speaker: transcript.speaker,
          participantId: transcript.participantId,
          startTime: transcript.timestamp,
          endTime: transcript.timestamp,
          messages: [transcript],
          speakerColor: getSpeakerColor(transcript.speaker),
          speakerConfidence: transcript.speakerConfidence,
          deepgramSpeaker: transcript.deepgramSpeaker,
        });
      }
    });

    return groups;
  }, [sharedTranscripts, getSpeakerColor]);

  // Format time range for transcript groups
  const formatTimeRange = (startTime: number, endTime: number) => {
    const start = formatTimestamp(startTime);
    if (startTime === endTime) {
      return start;
    }
    const end = formatTimestamp(endTime);
    return `${start} - ${end}`;
  };

  // AI chat submit
  const handleAiChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiChatInput.trim() || isAiProcessing) return;

    const messageText = aiChatInput.trim();
    let aiMessage = messageText;
    if (messageText.toLowerCase().startsWith('@web ')) {
      aiMessage = messageText;
    } else {
      aiMessage = messageText;
    }
    
    await handleAiChat(aiMessage);
    setAiChatInput('');
  };

  const handleAiChat = async (message: string) => {
    if (!message.trim() || isAiProcessing) return;

    const currentUser = room?.localParticipant?.name || room?.localParticipant?.identity || 'User';
    const roomName = room?.name || 'unknown';

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

    const aiChatId = `ai-response-${Date.now()}`;
    const aiMessagePlaceholder = {
      id: aiChatId,
      type: 'ai' as const,
      message: '🧠 Thinking...',
      timestamp: Date.now(),
      usedContext: false,
      relevantTranscripts: 0,
      usedWebSearch: false,
      citations: undefined as string[] | undefined,
      isThinking: true,
    };

    setAiChatHistory(prev => [...prev, aiMessagePlaceholder]);

    try {
      const currentTranscripts = sharedTranscripts
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      const response = await fetch('/api/ai-chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          roomName,
          userName: currentUser,
          currentTranscripts,
          isLiveMeeting: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedMessage = '';
      let finalMetadata = {};

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                break;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'metadata') {
                  console.log('📊 AI processing metadata:', parsed);
                } else if (parsed.type === 'context') {
                  console.log('📋 AI context:', parsed);
                  finalMetadata = {
                    ...finalMetadata,
                    usedContext: parsed.usedContext,
                    relevantTranscripts: parsed.relevantTranscripts,
                    queryType: parsed.queryType,
                    confidence: parsed.confidence
                  };
                } else if (parsed.type === 'text') {
                  accumulatedMessage += parsed.content;
                  
                  setAiChatHistory(prev => 
                    prev.map(msg => 
                      msg.id === aiChatId 
                        ? { ...msg, message: accumulatedMessage, isThinking: false, ...finalMetadata }
                        : msg
                    )
                  );
                } else if (parsed.type === 'complete') {
                  finalMetadata = {
                    ...finalMetadata,
                    usedWebSearch: parsed.usedWebSearch,
                    citations: parsed.citations
                  };
                  
                  setAiChatHistory(prev => 
                    prev.map(msg => 
                      msg.id === aiChatId 
                        ? { ...msg, message: parsed.content, ...finalMetadata }
                        : msg
                    )
                  );
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error || 'Unknown error');
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending AI chat:', error);
      
      setAiChatHistory(prev => 
        prev.map(msg => 
          msg.id === aiChatId 
            ? { ...msg, message: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Transcription service setup
  const transcriptionService = React.useMemo(() => 
    new TranscriptionService(room, (transcript: Transcript) => {
      console.log('📝 Transcript received:', transcript);
      setTranscripts(prev => {
        const updated = [...prev, transcript];
        return updated;
      });

      useMeetingStore.getState().addTranscript({
        id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp,
        participantId: transcript.participantId,
        isLocal: transcript.participantId === room?.localParticipant?.identity,
        speakerConfidence: transcript.speakerConfidence
      });

      const shareMessage = {
        type: 'transcript',
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp,
        participantId: transcript.participantId || 'unknown',
        speakerConfidence: transcript.speakerConfidence,
        entryId: `${transcript.participantId || 'unknown'}-${transcript.timestamp}`,
        isLocal: false
      };
      
      try {
        console.log('📡 Sharing transcript to other participants:', shareMessage);
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(shareMessage)),
          { reliable: true }
        );
        console.log('✅ Transcript shared successfully');
      } catch (error) {
        console.error('❌ Failed to share transcript:', error);
      }

      const localDisplayTranscript: DisplayTranscript = {
        speaker: transcript.speaker,
        text: transcript.text,
        participantId: transcript.participantId || 'unknown',
        timestamp: transcript.timestamp,
        entryId: `${transcript.participantId || 'unknown'}-${transcript.timestamp}`,
        isLocal: true,
        speakerConfidence: transcript.speakerConfidence
      };

      setSharedTranscripts(prev => {
        const existingIndex = prev.findIndex(t => t.entryId === localDisplayTranscript.entryId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = localDisplayTranscript;
          return updated;
        } else {
          const insertIndex = prev.findIndex(t => t.timestamp > localDisplayTranscript.timestamp);
          if (insertIndex === -1) {
            return [...prev, localDisplayTranscript];
          } else {
            const updated = [...prev];
            updated.splice(insertIndex, 0, localDisplayTranscript);
            return updated;
          }
        }
      });
    }), [room]);

  // Listen for shared transcript data from other participants
  React.useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload)) as SharedTranscript;
        
        const currentUserId = room.localParticipant?.identity || room.localParticipant?.name || user?.id || 'guest';
        if (data.participantId === currentUserId) {
          return;
        }
        
        if (data.speakerConfidence !== undefined && data.speakerConfidence <= 0.3) {
          return;
        }
        
        if (data.type === 'transcript' || data.type === 'transcript_update') {
          setSharedTranscripts(prev => {
            const existingIndex = prev.findIndex(t => t.entryId === data.entryId);
            
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                speaker: data.speaker,
                text: data.text,
                participantId: data.participantId,
                timestamp: data.timestamp,
                entryId: data.entryId,
                isLocal: false,
                speakerConfidence: data.speakerConfidence,
                deepgramSpeaker: data.deepgramSpeaker
              };
              return updated;
            } else {
              const newTranscript: DisplayTranscript = {
                speaker: data.speaker,
                text: data.text,
                participantId: data.participantId,
                timestamp: data.timestamp,
                entryId: data.entryId,
                isLocal: false,
                speakerConfidence: data.speakerConfidence,
                deepgramSpeaker: data.deepgramSpeaker
              };
              
              const insertIndex = prev.findIndex(t => t.timestamp > data.timestamp);
              if (insertIndex === -1) {
                return [...prev, newTranscript];
              } else {
                const updated = [...prev];
                updated.splice(insertIndex, 0, newTranscript);
                return updated;
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

  // Monitor microphone state changes
  useEffect(() => {
    if (!room?.localParticipant || !transcriptionService) return;

    const handleMicStateChange = () => {
      const isMicEnabled = room.localParticipant?.isMicrophoneEnabled ?? false;
      console.log('🎤 AI Assistant: Microphone state change detected:', isMicEnabled);
      console.log('📊 Transcription status before handling:', transcriptionService.getStatus());
      
      transcriptionService.handleMicrophoneStateChange(isMicEnabled);
      
      // Check status after handling
      setTimeout(() => {
        console.log('📊 Transcription status after handling:', transcriptionService.getStatus());
        setIsRecording(transcriptionService.isActivelyRecording());
      }, 300);
    };

    // Listen for microphone state changes
    room.localParticipant.on('trackMuted', handleMicStateChange);
    room.localParticipant.on('trackUnmuted', handleMicStateChange);

    return () => {
      room.localParticipant?.off('trackMuted', handleMicStateChange);
      room.localParticipant?.off('trackUnmuted', handleMicStateChange);
    };
  }, [room, transcriptionService]);

  // Auto-start transcription when audio tracks are available
  const startTranscription = useCallback(async () => {
    if (isRecording) return;
    
    const audioTracks = tracks.filter(track => track.publication.source === Track.Source.Microphone);
    console.log('🎤 Audio tracks found:', audioTracks.length);
    if (audioTracks.length === 0) return;

    try {
      console.log('🎙️ Starting transcription...');
      setIsRecording(true);
      const track = audioTracks[0].publication?.track;
      if (!track) {
        console.log('❌ No track found');
        setIsRecording(false);
        return;
      }

      await transcriptionService.startTranscription();
      console.log('✅ Transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      setIsRecording(false);
    }
  }, [transcriptionService, isRecording, tracks]);

  useEffect(() => {
    const audioTracks = tracks.filter(track => track.publication.source === Track.Source.Microphone);
    
    if (audioTracks.length > 0 && !isRecording) {
      startTranscription();
    }
  }, [tracks, startTranscription, isRecording]);

  // Notify parent component when transcripts change
  useEffect(() => {
    if (onTranscriptsChange) {
      const allTranscripts: Transcript[] = [
        ...transcripts,
        ...sharedTranscripts.map(st => ({
          speaker: st.speaker,
          text: st.text,
          timestamp: st.timestamp
        }))
      ];
      
      allTranscripts.sort((a, b) => a.timestamp - b.timestamp);
      onTranscriptsChange(allTranscripts);
    }
  }, [transcripts, sharedTranscripts, onTranscriptsChange]);

  // Cleanup transcription service on unmount
  useEffect(() => {
    return () => {
      if (transcriptionService) {
        try {
          transcriptionService.stopTranscription();
        } catch (error) {
          console.error('Error stopping transcription service:', error);
        }
      }
    };
  }, [transcriptionService]);

  if (!isOpen) return null;

  return (
    <>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-header-content">
          <div className="panel-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="panel-title">AI Assistant</h3>
          <button
            onClick={() => {
              console.log('Transcript toggle clicked, current state:', showTranscripts);
              console.log('Shared transcripts count:', sharedTranscripts.length);
              console.log('Is recording:', isRecording);
              console.log('Transcription service status:', transcriptionService?.getStatus());
              setShowTranscripts(!showTranscripts);
            }}
            className={`transcript-toggle ${showTranscripts ? 'active' : ''}`}
          >
            Transcripts
          </button>
        </div>
          <button onClick={onClose} className="close-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
      </div>

      {/* Content */}
      <div className="panel-content">
        {showTranscripts ? (
          <div className="transcript-section full-panel">
            <div ref={transcriptMessagesRef} className="transcript-messages full-height">
              {sharedTranscripts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <p>Transcription will appear here once the meeting starts</p>
                </div>
              ) : (
                <div className="transcript-list">
                  {groupedTranscripts.map((group, groupIndex) => (
                    <div key={`${group.participantId}-${group.startTime}-${groupIndex}`} className="transcript-item">
                      <div className="transcript-item-header">
                        <span className={`speaker-badge ${group.speakerColor}`}>
                          {group.speaker}
                        </span>
                      </div>
                      <div className="transcript-text">
                        {group.messages.map(message => message.text).join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* AI Chat */
        <div className="ai-chat-section">
          <div className="panel-messages" ref={chatMessagesRef} onScroll={handleScroll}>
            {aiChatHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p>Ask AI about the meeting, participants, or search the web</p>
                
                <div className="suggestion-list">
                  <p className="suggestion-title">Try asking:</p>
                  <div className="suggestion-buttons">
                    {questionSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="suggestion-button"
                        onClick={() => handleAiChat(suggestion)}
                        disabled={isAiProcessing}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="messages-list">
                {aiChatHistory.map((aiMsg) => (
                  <div key={aiMsg.id} className={`message-group ${aiMsg.type === 'ai' ? 'ai-message' : 'user-message'}`}>
                    <div className="message-header">
                      <div className="message-sender">
                        <span className="sender-name">
                          {aiMsg.type === 'ai' ? 'AI Assistant' : aiMsg.userName}
                                </span>
                        <div className="message-badges">
                          {aiMsg.usedWebSearch && (
                            <span className="badge web-badge">Web Search</span>
                              )}
                              {aiMsg.usedContext && (
                            <span className="badge context-badge">Context</span>
                              )}
                        </div>
                      </div>
                      {aiMsg.type === 'ai' && (
                        <button
                          onClick={() => copyToClipboard(aiMsg.message)}
                          className="copy-button"
                          title="Copy response"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="message-content">
                      {(aiMsg as any).isThinking ? (
                        <div className="thinking-container">
                          <div className="typing-indicator">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                          <span className="thinking-text">🧠 Thinking...</span>
                        </div>
                      ) : (
                        <ReactMarkdown>{aiMsg.message}</ReactMarkdown>
                      )}
                    </div>
                    
                    {aiMsg.type === 'ai' && aiMsg.citations && aiMsg.citations.length > 0 && (
                      <div className="message-citations">
                        <button
                          onClick={() => toggleSources(aiMsg.id)}
                          className="citations-toggle"
                        >
                          Sources ({aiMsg.citations.length})
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {expandedSources.has(aiMsg.id) && (
                          <div className="citations-list">
                            {aiMsg.citations.map((url, index) => (
                              <a 
                                key={index}
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="citation-link"
                              >
                                {new URL(url).hostname}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Always show question suggestions after messages */}
                {aiChatHistory.length > 0 && (
                  <div className="suggestion-list" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                    <p className="suggestion-title">Try asking:</p>
                    <div className="suggestion-buttons">
                      {questionSuggestions.slice(0, 3).map((suggestion, index) => (
                        <button
                          key={index}
                          className="suggestion-button"
                          onClick={() => handleAiChat(suggestion)}
                          disabled={isAiProcessing}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Input */}
          <div className="panel-input">
            <form onSubmit={handleAiChatSubmit} className="input-form">
              <div className="input-controls">
                <button
                  type="button"
                  className={`control-button ${aiChatInput.toLowerCase().startsWith('@web ') ? 'active' : ''}`}
                  onClick={() => {
                    if (aiChatInput.toLowerCase().startsWith('@web ')) {
                      setAiChatInput(aiChatInput.slice(5));
                    } else {
                      setAiChatInput(`@web ${aiChatInput}`);
                    }
                  }}
                  disabled={isAiProcessing}
                >
                  Web Search
                </button>
              </div>
              <div className="input-row">
                <input
                  type="text"
                  className="message-input"
                  placeholder={aiChatInput.toLowerCase().startsWith('@web ') ? "Search the web..." : "Ask AI about the meeting..."}
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  disabled={isAiProcessing}
                />
                <button 
                  type="submit" 
                  className="send-button"
                  disabled={isAiProcessing || !aiChatInput.trim()}
                >
                  {isAiProcessing ? (
                    <div className="spinner"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="m5 12 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m12 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        )}
      </div>
    </>
  );
} 