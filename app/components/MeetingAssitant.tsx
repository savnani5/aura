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
  const [privateSubView, setPrivateSubView] = useState<PrivateSubView>('ohm');
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
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
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

  // Function to make URLs clickable
  const makeLinksClickable = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-link"
            style={{
              color: '#60a5fa',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
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
  useEffect(() => {
    if (transcriptMessagesRef.current && sharedTranscripts.length > 0) {
      // Smooth scroll to bottom when new transcript arrives
      setTimeout(() => {
        if (transcriptMessagesRef.current) {
          transcriptMessagesRef.current.scrollTop = transcriptMessagesRef.current.scrollHeight;
        }
      }, 100); // Small delay to ensure DOM has updated
    }
  }, [sharedTranscripts.length]); // Trigger on transcript count change

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
      
      // Check if this transcript should be grouped with the previous one
      // More generous time window for better conversation flow
      const shouldGroup = lastGroup && 
        lastGroup.speaker === transcript.speaker &&
        lastGroup.participantId === transcript.participantId &&
        (transcript.timestamp - lastGroup.endTime) < 30000; // Increased to 30 seconds for better grouping
      
      if (shouldGroup) {
        // Add to existing group
        lastGroup.messages.push(transcript);
        lastGroup.endTime = transcript.timestamp;
        // Update confidence to latest if available
        if (transcript.speakerConfidence !== undefined) {
          lastGroup.speakerConfidence = transcript.speakerConfidence;
        }
        if (transcript.deepgramSpeaker !== undefined) {
          lastGroup.deepgramSpeaker = transcript.deepgramSpeaker;
        }
      } else {
        // Create new group
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

  // Share transcript with other participants via data channel
  const shareTranscript = useCallback((transcript: Transcript) => {
    // Filter out low confidence transcripts (30% or less) to prevent incorrect speaker attribution
    if (transcript.speakerConfidence !== undefined && transcript.speakerConfidence <= 0.3) {
      console.log('🔍 TRANSCRIPT SHARE: Skipping low confidence transcript:', {
        speaker: transcript.speaker,
        confidence: transcript.speakerConfidence,
        text: transcript.text.substring(0, 50) + '...',
        reason: 'Speaker confidence too low (≤30%)'
      });
      return;
    }
    
    // Check if room and connection are still active before sharing
    if (!room?.localParticipant || !sendData || room.state !== 'connected') {
      console.log('🔍 TRANSCRIPT SHARE: Skipping share - room not connected or missing dependencies:', {
        hasRoom: !!room,
        hasLocalParticipant: !!room?.localParticipant,
        hasSendData: !!sendData,
        roomState: room?.state
      });
      return;
    }

    const participantId = transcript.participantId || room.localParticipant.identity;
    const speaker = transcript.speaker || room.localParticipant.name || participantId;
    
    console.log('🔍 TRANSCRIPT SHARE DEBUG: Sharing transcript:', {
      speaker,
      text: transcript.text.substring(0, 50) + '...',
      participantId,
      timestamp: new Date(transcript.timestamp).toLocaleTimeString()
    });
    
    // Create new transcript entry - no concatenation to avoid duplication
    const newTranscript: DisplayTranscript = {
      speaker: speaker,
      text: transcript.text,
      participantId: participantId,
      timestamp: transcript.timestamp,
      entryId: `${participantId}-${Date.now()}-${Math.random()}`,
      isLocal: true,
      speakerConfidence: transcript.speakerConfidence,
      deepgramSpeaker: transcript.deepgramSpeaker
    };
    
    console.log('🔍 TRANSCRIPT NEW ENTRY: Created new entry:', {
      speaker,
      text: transcript.text.substring(0, 50) + '...',
      participantId,
      entryId: newTranscript.entryId
    });
    
    // Add to shared transcripts
    setSharedTranscripts(prev => [...prev, newTranscript]);
    
    // Send the transcript to other participants with additional safety checks
    setTimeout(() => {
      // Double-check connection state before sending
      if (!room || room.state !== 'connected' || !sendData) {
        console.log('🔍 TRANSCRIPT SHARE: Connection closed before sending, skipping');
        return;
      }

      const sharedData: SharedTranscript = {
        id: `${participantId}-${Date.now()}`,
        speaker: speaker,
        text: newTranscript.text,
        participantId: participantId,
        timestamp: newTranscript.timestamp,
        entryId: newTranscript.entryId,
        type: 'transcript',
        isLocal: false,
        speakerConfidence: newTranscript.speakerConfidence,
        deepgramSpeaker: newTranscript.deepgramSpeaker
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(sharedData));
      
      try {
        // Final check before sending
        if (room.state === 'connected') {
          sendData(data, { reliable: true });
          console.log('🔍 TRANSCRIPT SENT: Shared via data channel:', {
            speaker,
            text: sharedData.text.substring(0, 50) + '...',
            entryId: sharedData.entryId
          });
        } else {
          console.log('🔍 TRANSCRIPT SHARE: Room disconnected, skipping send');
        }
      } catch (error) {
        console.error('Error sending transcript data (connection may be closed):', error);
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
        const currentUserId = room.localParticipant?.identity || room.localParticipant?.name || user?.id || 'guest';
        if (data.participantId === currentUserId) {
          console.log('🔍 TRANSCRIPT DEBUG: Skipping own transcript from data channel to prevent duplication');
          return;
        }
        
        console.log('🔍 TRANSCRIPT RECEIVED: From remote participant:', {
          speaker: data.speaker,
          text: data.text.substring(0, 50) + '...',
          participantId: data.participantId,
          entryId: data.entryId,
          timestamp: new Date(data.timestamp).toLocaleTimeString()
        });
        
        // Filter out low confidence transcripts from remote participants too
        if (data.speakerConfidence !== undefined && data.speakerConfidence <= 0.3) {
          console.log('🔍 TRANSCRIPT RECEIVED: Skipping low confidence remote transcript:', {
            speaker: data.speaker,
            confidence: data.speakerConfidence,
            text: data.text.substring(0, 50) + '...',
            reason: 'Remote speaker confidence too low (≤30%)'
          });
          return;
        }
        
        if (data.type === 'transcript' || data.type === 'transcript_update') {
          setSharedTranscripts(prev => {
            // Check if this exact transcript already exists (avoid duplicates)
            const existingIndex = prev.findIndex(t => t.entryId === data.entryId);
            
            if (existingIndex >= 0) {
              // Update existing entry
              console.log('🔍 TRANSCRIPT UPDATE: Updating existing remote transcript');
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
              // Add new transcript entry in chronological order
              console.log('🔍 TRANSCRIPT NEW: Adding new remote transcript');
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
              
              // Insert in chronological order
              const insertIndex = prev.findIndex(t => t.timestamp > data.timestamp);
              if (insertIndex === -1) {
                // Add to end
                return [...prev, newTranscript];
              } else {
                // Insert at correct position
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
    if (!room?.name) return;
    
    // Use participant identity or user ID for storage key
    const userId = user?.id || room.localParticipant?.identity || 'guest';
    const storageKey = `meeting-notes-${room.name}-${userId}`;
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [user, room?.name, room?.localParticipant?.identity]);

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
    if (!room?.name) return;

    setSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      // Use participant identity or user ID for storage key
      const userId = user?.id || room.localParticipant?.identity || 'guest';
      const storageKey = `meeting-notes-${room.name}-${userId}`;
      
      // Always save, even empty notes (which removes the key)
      if (notes.trim()) {
        localStorage.setItem(storageKey, notes);
      } else {
        localStorage.removeItem(storageKey);
      }
      setSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, user, room?.name, room?.localParticipant?.identity]);

  // Cleanup transcription service on unmount or room disconnect
  useEffect(() => {
    return () => {
      console.log('🔄 Cleaning up transcription service...');
      if (transcriptionService) {
        try {
          transcriptionService.stopTranscription();
        } catch (error) {
          console.error('Error stopping transcription service:', error);
        }
      }
    };
  }, [transcriptionService]);

  // Stop transcription when room disconnects
  useEffect(() => {
    if (!room) return;

    const handleDisconnected = () => {
      console.log('🔌 Room disconnected, stopping transcription...');
      if (transcriptionService && isRecording) {
        try {
          transcriptionService.stopTranscription();
          setIsRecording(false);
        } catch (error) {
          console.error('Error stopping transcription on disconnect:', error);
        }
      }
      
      // Handle meeting end when user disconnects
      handleMeetingEnd();
    };

    room.on('disconnected', handleDisconnected);
    
    return () => {
      room.off('disconnected', handleDisconnected);
    };
  }, [room, transcriptionService, isRecording]);

  // Function to handle meeting end and send summary emails
  const handleMeetingEnd = async () => {
    if (!room?.name) return;
    
    try {
      console.log('🔚 Handling meeting end for room:', room.name);
      
      // Get current room participants (from LiveKit) - handle types properly
      const allParticipants = [];
      
      // Add remote participants
      room.remoteParticipants.forEach(participant => {
        allParticipants.push(participant);
      });
      
      // Add local participant if exists
      if (room.localParticipant) {
        allParticipants.push(room.localParticipant);
      }
      
      // Combine all transcripts for the meeting
      const allTranscripts = [
        ...transcripts,
        ...sharedTranscripts.map(st => ({
          speaker: st.speaker,
          text: st.text,
          timestamp: st.timestamp,
          speakerConfidence: st.speakerConfidence,
          deepgramSpeaker: st.deepgramSpeaker,
          participantId: st.participantId
        }))
      ];
      
      // Sort by timestamp
      allTranscripts.sort((a, b) => a.timestamp - b.timestamp);
      
      // Format transcripts for the API (convert timestamp to Date object)
      const formattedTranscripts = allTranscripts.map(t => ({
        speaker: t.speaker,
        text: t.text,
        timestamp: new Date(t.timestamp),
        speakerConfidence: t.speakerConfidence,
        deepgramSpeaker: t.deepgramSpeaker,
        participantId: t.participantId
      }));
      
      // Extract participant information with proper structure for the /end endpoint
      const participantsData = allParticipants.map(p => ({
        name: p.name || p.identity || 'Unknown Participant',
        identity: p.identity,
        isHost: false // You may want to determine host status differently
      })).filter(p => p.identity); // Filter out invalid participants
      
      // Calculate approximate meeting duration (in minutes)
      const startTime = allTranscripts.length > 0 ? allTranscripts[0].timestamp : Date.now();
      const endTime = Date.now();
      const duration = Math.max(1, Math.round((endTime - startTime) / (1000 * 60))); // At least 1 minute
      
      console.log('📊 Meeting end data:', {
        roomName: room.name,
        participantCount: participantsData.length,
        transcriptCount: formattedTranscripts.length,
        duration: duration
      });
      
      // Only process meeting end if there are participants and transcript content
      if (participantsData.length > 0 && formattedTranscripts.length > 0) {
        // Generate a meeting ID for this session
        const meetingId = `meeting-${room.name}-${Date.now()}`;
        
        // Call the comprehensive /end API endpoint
        const response = await fetch(`/api/meetings/${room.name}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId: meetingId,
            transcripts: formattedTranscripts,
            participants: participantsData,
            endedAt: new Date().toISOString(),
            duration: duration
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Meeting ended successfully, summary generated and emails sent');
        } else {
          console.error('❌ Failed to end meeting:', result.error);
        }
      } else {
        console.log('⏭️ Skipping meeting end - no participants or transcript content');
      }
    } catch (error) {
      console.error('❌ Error handling meeting end:', error);
    }
  };

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
      if (room?.name) {
        // Use participant identity or user ID for storage key
        const userId = user?.id || room.localParticipant?.identity || 'guest';
        const storageKey = `meeting-notes-${room.name}-${userId}`;
        localStorage.removeItem(storageKey);
      }
    }
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
        
        {/* Main View Toggle */}
        <div className="main-view-toggle">
          <button 
            className={`view-toggle-button ${activeView === 'private' ? 'view-toggle-button--active' : ''}`}
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
            title="Only visible to you"
          >
            🔒 Private
            {(aiChatHistory.length > 0 || notes.trim()) && (
              <span className="notification-dot"></span>
            )}
          </button>
          <button 
            className={`view-toggle-button ${activeView === 'public' ? 'view-toggle-button--active' : ''}`}
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
            title="Visible to all participants"
          >
            👥 Shared
            {(groupedChatMessages.length > 0 || sharedTranscripts.length > 0) && (
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
                              {makeLinksClickable(msg.text)}
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
                      {isSending ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        </svg>
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
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      onClick={() => {
                        if (transcriptionService) {
                          transcriptionService.resetSpeakerMappings();
                          console.log('🔄 Speaker mappings reset via debug button');
                        }
                      }}
                      className="debug-button"
                      title="Reset speaker mappings (dev only)"
                      style={{
                        marginLeft: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Reset Speakers
                    </button>
                  )}
                </div>
                
                <div className="transcript-messages" ref={transcriptMessagesRef}>
                  {sharedTranscripts.length === 0 ? (
                    <div className="transcript-empty">
                      <div className="empty-icon">🎙️</div>
                      <p>Transcription will appear here once the meeting starts</p>
                    </div>
                  ) : (
                    groupedTranscripts.map((group, groupIndex) => (
                      <div key={`${group.participantId}-${group.startTime}-${groupIndex}`} className="transcript-group">
                        <div className="transcript-group-header">
                          <div className={`speaker-badge ${group.speakerColor}`}>
                            🎤 {group.speaker}
                            {group.speakerConfidence !== undefined && (
                              <span 
                                className="speaker-confidence"
                                style={{
                                  fontSize: '0.625rem',
                                  marginLeft: '0.25rem',
                                  padding: '0.125rem 0.25rem',
                                  borderRadius: '4px',
                                  background: group.speakerConfidence > 0.8 ? '#22c55e' : 
                                            group.speakerConfidence > 0.5 ? '#f59e0b' : '#ef4444',
                                  color: 'white'
                                }}
                                title={`Speaker confidence: ${Math.round((group.speakerConfidence || 0) * 100)}%${group.deepgramSpeaker ? ` (Deepgram ID: ${group.deepgramSpeaker})` : ''}`}
                              >
                                {Math.round((group.speakerConfidence || 0) * 100)}%
                              </span>
                            )}
                          </div>
                          <span className="transcript-timestamp">
                            {formatTimeRange(group.startTime, group.endTime)}
                          </span>
                        </div>
                        <div className="transcript-group-content">
                          {/* Concatenate all messages from the same speaker into continuous text */}
                          <div className="transcript-message">
                            <p className="transcript-text">
                              {makeLinksClickable(group.messages.map(message => message.text).join(' '))}
                            </p>
                          </div>
                        </div>
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
                className={`sub-tab-button ${privateSubView === 'ohm' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPrivateSubView('ohm')}
              >
                🤖 Ask AI
                {aiChatHistory.length > 0 && (
                  <span className="chat-badge">{aiChatHistory.length}</span>
                )}
              </button>
              <button 
                className={`sub-tab-button ${privateSubView === 'notes' ? 'sub-tab-button--active' : ''}`}
                onClick={() => setPrivateSubView('notes')}
              >
                📝 Notes
                {notes.trim() && (
                  <span className="notification-dot"></span>
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
                  </div>
                  <div className="save-status">
                    <span className={`save-indicator save-indicator--${saveStatus}`}>
                      {saveStatus === 'saved' && '✅ Auto-saved'}
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
                      <p>Ask AI about the meeting, participants, or search the web!</p>
                      
                      <div className="ai-suggestions" style={{ marginTop: '0.75rem' }}>
                        <p className="suggestions-title">💡 Try asking AI:</p>
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
                        <p className="suggestions-title-compact">💡 Ask AI:</p>
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
                                  Ask AI
                                  {aiMsg.usedWebSearch && (
                                    <span style={{ 
                                      fontSize: '0.625rem', 
                                      background: '#4ade80', 
                                      color: 'white',
                                      padding: '0.125rem 0.25rem',
                                      borderRadius: '4px'
                                    }}>
                                      🌐 search web
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
                            {aiMsg.type === 'ai' ? (
                              <button
                                onClick={() => copyToClipboard(aiMsg.message)}
                                className="copy-icon-button"
                                title="Copy response"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                              </button>
                            ) : (
                              <span className="chat-timestamp">
                                {formatTimestamp(aiMsg.timestamp)}
                              </span>
                            )}
                          </div>
                          <div className="chat-message-text">
                            <div className="chat-message">
                              <ReactMarkdown>{aiMsg.message}</ReactMarkdown>
                            </div>
                            
                            {/* Copy Button and Sources for AI messages */}
                            {aiMsg.type === 'ai' && (
                              <div className="message-actions">
                                <button
                                  onClick={() => copyToClipboard(aiMsg.message)}
                                  className="copy-button"
                                  title="Copy response"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                                  </svg>
                                  Copy
                                </button>
                                
                                {aiMsg.citations && aiMsg.citations.length > 0 && (
                                  <button
                                    onClick={() => toggleSources(aiMsg.id)}
                                    className="sources-toggle"
                                    title="Toggle sources"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Sources ({aiMsg.citations.length})
                                    <span className={`chevron ${expandedSources.has(aiMsg.id) ? 'expanded' : ''}`}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}
                            
                            {/* Sources dropdown - separate from the button */}
                            {aiMsg.type === 'ai' && aiMsg.citations && aiMsg.citations.length > 0 && expandedSources.has(aiMsg.id) && (
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
                            <span className="chat-sender">Ask AI</span>
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
                      🌐 search web
                    </button>
                  </div>
                  <div className="chat-input-row">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder={aiChatInput.toLowerCase().startsWith('@web ') ? "🔍 Search the web..." : "🤖 Ask AI about the meeting..."}
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
                      {isAiProcessing ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        </svg>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
} 