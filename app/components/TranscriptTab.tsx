'use client';

import React, { useEffect, useState } from 'react';
import { useTracks, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Transcript, TranscriptionService } from '@/lib/transcription-service';

interface TranscriptTabProps {
  onMeetingEnd?: (transcripts: Transcript[]) => void;
}

interface DisplayTranscript {
  speaker: string;
  text: string;
  timestamp: number;
}

export function TranscriptTab({ onMeetingEnd }: TranscriptTabProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [displayTranscripts, setDisplayTranscripts] = useState<DisplayTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const room = useRoomContext();
  const tracks = useTracks();
  const transcriptionService = React.useMemo(() => new TranscriptionService(room), [room]);

  // Filter audio tracks
  const audioTracks = tracks.filter(
    (track) => track.source === Track.Source.Microphone && track.participant.identity !== 'recorder'
  );

  // Process transcripts to combine consecutive messages from the same speaker
  useEffect(() => {
    const processed: DisplayTranscript[] = [];
    let currentSpeaker = '';
    let currentText = '';
    let currentTimestamp = 0;

    transcripts.forEach((transcript) => {
      if (transcript.speaker !== currentSpeaker) {
        // If we have accumulated text, add it to processed
        if (currentText) {
          processed.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: currentTimestamp
          });
        }
        // Start new speaker
        currentSpeaker = transcript.speaker;
        currentText = transcript.text;
        currentTimestamp = transcript.timestamp;
      } else {
        // Append to current speaker's text
        currentText += ' ' + transcript.text;
      }
    });

    // Add the last message
    if (currentText) {
      processed.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        timestamp: currentTimestamp
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

  const startTranscription = async () => {
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
  };

  const stopTranscription = () => {
    setIsRecording(false);
    transcriptionService.stopTranscription();
  };

  return (
    <div className="fixed bottom-0 right-0 w-96 h-[calc(100vh-4rem)] bg-white shadow-lg border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Meeting Transcript</h3>
        <div className="mt-2">
          {!isRecording ? (
            <button onClick={startTranscription} className="lk-button">
              Start Recording
            </button>
          ) : (
            <button onClick={stopTranscription} className="lk-button">
              Stop Recording
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {displayTranscripts.map((transcript, index) => (
          <div key={index} className="mb-4">
            <div className="font-semibold text-blue-600">{transcript.speaker}:</div>
            <div className="ml-4 mt-1">
              {transcript.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 