'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTracks, useRoomContext, useDataChannel } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/services/transcription';
import { useUser } from '@clerk/nextjs';
import { useMeetingStore } from '@/lib/state';
import { 
  X, 
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PermissionModal } from './permission-modal';
import { isPermissionError, parsePermissionError } from '@/lib/utils/permission-utils';

interface TranscriptsPanelProps {
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

export function TranscriptsPanel({ onTranscriptsChange, isOpen, onClose }: TranscriptsPanelProps) {
  const { user } = useUser();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [sharedTranscripts, setSharedTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  // Permission modal state
  const [permissionModal, setPermissionModal] = React.useState<{
    isOpen: boolean;
    type: 'camera' | 'microphone' | 'screen' | 'audio';
    error?: string;
  }>({
    isOpen: false,
    type: 'microphone'
  });
  const room = useRoomContext();
  const tracks = useTracks();

  // Refs for auto-scrolling
  const transcriptMessagesRef = React.useRef<HTMLDivElement>(null);
  const sharedTranscriptsRef = React.useRef<DisplayTranscript[]>([]);

  // Update ref whenever sharedTranscripts changes
  React.useEffect(() => {
    sharedTranscriptsRef.current = sharedTranscripts;
  }, [sharedTranscripts]);

  // Data channel for sharing transcripts
  const { send: sendData } = useDataChannel('transcript-sync');

  // Generate speaker colors for consistency
  const getSpeakerColor = (speaker: string) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'red', 'yellow'];
    const hash = speaker.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
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
      console.log('🎤 Transcripts Panel: Microphone state change detected:', isMicEnabled);
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
      
      // Check if this is a permission error
      if (isPermissionError(error)) {
        const permissionError = parsePermissionError(error, 'microphone');
        setPermissionModal({
          isOpen: true,
          type: 'microphone',
          error: permissionError.message
        });
      }
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
    <div className="h-full flex flex-col bg-[#1a1a1a] text-white border-l border-[rgba(55,65,81,0.3)] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgba(55,65,81,0.3)]">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-400" />
          <h3 className="font-medium text-white">Live Transcripts</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X size={18} />
        </Button>
      </div>

      {/* Transcripts Content */}
      <div className="flex-1 overflow-y-auto p-4" ref={transcriptMessagesRef}>
        {sharedTranscripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4">
              <FileText size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-400 text-sm">Transcription will appear here once the meeting starts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTranscripts.map((group, groupIndex) => (
              <div key={`${group.participantId}-${group.startTime}-${groupIndex}`} className="space-y-2">
                {/* Speaker Name */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-full text-xs font-semibold text-white",
                    group.speakerColor === 'blue' ? 'bg-blue-600' :
                    group.speakerColor === 'green' ? 'bg-green-600' :
                    group.speakerColor === 'purple' ? 'bg-purple-600' :
                    group.speakerColor === 'orange' ? 'bg-orange-600' :
                    group.speakerColor === 'red' ? 'bg-red-600' :
                    group.speakerColor === 'yellow' ? 'bg-yellow-600' :
                    'bg-gray-600'
                  )}>
                    {group.speaker}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(group.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Transcript Text */}
                <div className="pl-4 border-l-2 border-[#374151]">
                  <p className="text-sm text-white leading-relaxed">
                    {group.messages.map(message => message.text).join(' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Permission Modal */}
      <PermissionModal
        isOpen={permissionModal.isOpen}
        onClose={() => setPermissionModal({ ...permissionModal, isOpen: false })}
        permissionType={permissionModal.type}
        error={permissionModal.error}
      />
    </div>
  );
} 