import { Track, Room } from 'livekit-client';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

interface DeepgramTranscription {
  channel: {
    alternatives: Array<{
      transcript: string;
      speaker?: string;
    }>;
  };
}

export interface Transcript {
  speaker: string;
  text: string;
  timestamp: number;
}

export class TranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private transcriptionCallback: ((transcript: Transcript) => void) | null = null;
  private connection: any | null = null;
  private room: Room | null = null;

  constructor(room: Room) {
    this.room = room;
  }

  async startTranscription(
    audioTrack: MediaStreamTrack,
    onTranscript: (transcript: Transcript) => void
  ) {
    this.transcriptionCallback = onTranscript;
    
    // Create audio context
    this.audioContext = new AudioContext();
    
    // Create media stream from track
    const stream = new MediaStream([audioTrack]);
    
    // Create media recorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm',
    });

    try {
      // Initialize Deepgram client
      const deepgram = createClient(process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '');

      // Create live transcription connection
      this.connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        diarize: true,
      });

      // Set up event listeners
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Connection established');
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Connection closed');
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscription) => {
        if (data.channel?.alternatives?.[0]?.transcript && this.transcriptionCallback) {
          const transcript: Transcript = {
            speaker: this.room?.localParticipant.name || this.room?.localParticipant.identity || 'Unknown',
            text: data.channel.alternatives[0].transcript,
            timestamp: Date.now(),
          };
          
          // Broadcast transcript to all participants
          const encodedData = new TextEncoder().encode(JSON.stringify(transcript));
          this.room?.localParticipant.publishData(
            encodedData,
            { reliable: true }
          );
          
          // Call the callback for local display
          this.transcriptionCallback(transcript);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('Transcription error:', error);
        this.stopTranscription();
      });

      // Handle data available event
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.connection) {
          // Send audio data to Deepgram
          this.connection.send(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('Error starting transcription:', error);
      this.stopTranscription();
    }
  }

  stopTranscription() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
    this.transcriptionCallback = null;
  }

  async summarizeTranscripts(transcripts: Transcript[]): Promise<string> {
    // Combine all transcripts
    const fullText = transcripts
      .map(t => `${t.speaker}: ${t.text}`)
      .join('\n');

    // Here you would integrate with a summarization service
    // Example: OpenAI GPT, Azure OpenAI, etc.
    
    // For now, return a placeholder
    return "Meeting Summary:\n" + fullText;
  }
} 