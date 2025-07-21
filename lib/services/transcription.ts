import { Room, Participant, RoomEvent, ParticipantEvent } from 'livekit-client';

export interface Transcript {
  speaker: string;
  text: string;
  timestamp: number;
  participantId?: string;
  speakerConfidence?: number;
}

// Browser Speech Recognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: any;
  abort(): void;
  start(): void;
  stop(): void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
  onstart: (event: any) => void;
  onend: (event: any) => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export class TranscriptionService {
  private room: Room;
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private transcriptCallback: (transcript: Transcript) => void;
  private activeSpeakers = new Set<string>();
  private currentSpeaker = 'Unknown';
  private currentSpeakerIdentity = 'unknown';

  constructor(room: Room, transcriptCallback: (transcript: Transcript) => void) {
    this.room = room;
    this.transcriptCallback = transcriptCallback;
    this.setupLiveKitEvents();
  }

  private setupLiveKitEvents() {
    // Listen for participant speaking events
    this.room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
      this.setupParticipantEvents(participant);
    });

    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      this.activeSpeakers.clear();
      speakers.forEach(speaker => {
        this.activeSpeakers.add(speaker.identity);
      });
      
      // Update current speaker to the first active speaker - use display name
      if (speakers.length > 0) {
        this.currentSpeaker = this.getDisplayName(speakers[0]);
        this.currentSpeakerIdentity = speakers[0].identity;
      }
    });

    // Setup events for existing participants
    this.room.remoteParticipants.forEach((participant: Participant) => {
      this.setupParticipantEvents(participant);
    });
    
    // Setup local participant
    if (this.room.localParticipant) {
      this.setupParticipantEvents(this.room.localParticipant);
      // Initialize current speaker as local participant
      this.currentSpeaker = this.getDisplayName(this.room.localParticipant);
      this.currentSpeakerIdentity = this.room.localParticipant.identity;
    }
  }

  private setupParticipantEvents(participant: Participant) {
    participant.on(ParticipantEvent.IsSpeakingChanged, (speaking) => {
      if (speaking) {
        this.activeSpeakers.add(participant.identity);
        this.currentSpeaker = this.getDisplayName(participant);
        this.currentSpeakerIdentity = participant.identity;
      } else {
        this.activeSpeakers.delete(participant.identity);
      }
    });
  }

  private getDisplayName(participant: Participant): string {
    // Use participant name if available, otherwise clean up the identity
    if (participant.name && participant.name.trim()) {
      return participant.name.trim();
    }
    
    // Fallback to cleaned identity - remove random suffixes like "__7lre"
    let cleanedIdentity = participant.identity || 'Unknown';
    
    // Remove common ID suffixes (pattern: __[alphanumeric])
    cleanedIdentity = cleanedIdentity.replace(/(__[a-zA-Z0-9]+)$/, '');
    
    // If it's an email, extract the name part
    if (cleanedIdentity.includes('@')) {
      cleanedIdentity = cleanedIdentity.split('@')[0];
    }
    
    return cleanedIdentity || 'Unknown';
  }

  async startTranscription(): Promise<void> {
    if (this.isRecording) {
      console.warn('Transcription already in progress');
      return;
    }

    // Check browser compatibility
    if (!TranscriptionService.isSupported()) {
      throw new Error('Speech Recognition not supported in this browser');
    }

    // Check microphone permissions first
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🎤 Microphone permission status:', permission.state);
      
      if (permission.state === 'denied') {
        throw new Error('Microphone permission denied. Please enable microphone access in your browser settings.');
      }
    } catch (error) {
      console.log('⚠️ Could not check microphone permissions:', error);
    }

    try {
      console.log('🚀 Setting up speech recognition...');
      this.setupRecognition();
      console.log('🎯 Starting speech recognition...');
      this.recognition?.start();
      this.isRecording = true;
      console.log('✅ Transcription service started successfully');
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      throw error;
    }
  }

  private getSpeechRecognition(): SpeechRecognition | null {
    // Chrome and Chromium-based browsers
    if ('webkitSpeechRecognition' in window) {
      return new (window as any).webkitSpeechRecognition();
    }
    
    // Standard API (future browsers)
    if ('SpeechRecognition' in window) {
      return new (window as any).SpeechRecognition();
    }
    
    return null;
  }

  private setupRecognition() {
    this.recognition = this.getSpeechRecognition();
    
    if (!this.recognition) {
      const support = TranscriptionService.getBrowserSupport();
      throw new Error(`Speech Recognition is not supported in this browser.\n\nSupported browsers:\n• Chrome (recommended)\n• Safari 14.1+\n• Edge (Chromium-based)\n\nYour browser: ${support.browser}\nAPI available: ${support.supported ? 'Yes' : 'No'}`);
    }

    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Event handlers
    this.recognition.onstart = () => {
      console.log('🎯 Speech recognition started successfully');
      console.log('🎤 Microphone enabled:', this.room.localParticipant?.isMicrophoneEnabled);
    };

    this.recognition.onresult = (event) => {
      console.log('🎤 Speech recognition result received:', event.results.length, 'results');
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;

        console.log(`🗣️ Result ${i}:`, {
          transcript: transcript,
          confidence: confidence,
          isFinal: isFinal,
          speaker: this.currentSpeaker
        });

        if (isFinal && transcript.trim()) {
          console.log('✅ Final transcript being sent:', transcript.trim());
          this.transcriptCallback({
            speaker: this.currentSpeaker,
            text: transcript.trim(),
            timestamp: Date.now(),
            participantId: this.currentSpeakerIdentity,
            speakerConfidence: confidence || 0.8
          });
        } else if (!isFinal) {
          console.log('⏳ Interim result:', transcript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      // Check if microphone is disabled - if so, don't log any errors
      const isMicEnabled = this.room.localParticipant?.isMicrophoneEnabled;
      if (!isMicEnabled) {
        console.log('Speech recognition error ignored - microphone is disabled:', event?.error || 'unknown error');
        return;
      }

      // More defensive error logging
      const errorInfo = {
        error: event?.error || 'unknown',
        message: event?.message || 'no message',
        type: event?.type || 'unknown',
        timeStamp: event?.timeStamp || Date.now()
      };

      // Only log if there's actual error information
      if (event?.error || event?.message) {
        console.error('Speech recognition error:', errorInfo);
      } else {
        console.log('Speech recognition event with no error details');
      }
      
      // Handle specific error types
      if (event?.error === 'not-allowed') {
        console.error('Microphone access denied. Please grant microphone permissions.');
      } else if (event?.error === 'network') {
        console.error('Network error. Please check your internet connection.');
      } else if (event?.error === 'no-speech') {
        console.warn('No speech detected. Try speaking louder or closer to the microphone.');
      } else if (event?.error === 'audio-capture') {
        console.error('Audio capture error. Please check your microphone.');
      }
    };

    this.recognition.onend = () => {
      console.log('🔚 Speech recognition ended, isRecording:', this.isRecording);
      
      if (this.isRecording) {
        // Check if microphone is still enabled before restarting
        const isMicEnabled = this.room.localParticipant?.isMicrophoneEnabled;
        console.log('🎤 Checking microphone state for restart:', isMicEnabled);
        
        if (isMicEnabled) {
          // Restart recognition if it stops unexpectedly and mic is still on
          console.log('🔄 Attempting to restart speech recognition...');
          setTimeout(() => {
            if (this.recognition && this.isRecording && this.room.localParticipant?.isMicrophoneEnabled) {
              try {
                this.recognition.start();
                console.log('✅ Speech recognition auto-restarted');
              } catch (error) {
                console.error('❌ Failed to auto-restart recognition:', error);
                // Try to recreate the recognition if restart fails
                this.setupRecognition();
                if (this.recognition) {
                  try {
                    this.recognition.start();
                    console.log('✅ Speech recognition recreated and restarted');
                  } catch (retryError) {
                    console.error('❌ Failed to recreate recognition:', retryError);
                  }
                }
              }
            } else {
              console.log('⚠️ Cannot restart - conditions not met:', {
                hasRecognition: !!this.recognition,
                isRecording: this.isRecording,
                micEnabled: this.room.localParticipant?.isMicrophoneEnabled
              });
            }
          }, 100);
        } else {
          console.log('🎤 Microphone is disabled, stopping transcription restart attempts');
        }
      }
    };
  }

  stopTranscription(): void {
    if (!this.isRecording) {
      console.warn('Transcription not in progress');
      return;
    }
    
    this.isRecording = false;

    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    console.log('Transcription stopped');
  }

  // Method to handle microphone state changes
  handleMicrophoneStateChange(isEnabled: boolean): void {
    console.log('🎤 Microphone state change:', {
      isEnabled,
      isRecording: this.isRecording,
      hasRecognition: !!this.recognition
    });
    
    if (!isEnabled && this.isRecording) {
      // Temporarily pause transcription when mic is disabled
      console.log('🎤 Microphone disabled, pausing transcription');
      if (this.recognition) {
        this.recognition.stop();
        // Don't set recognition to null here - keep the reference for restart
      }
    } else if (isEnabled && this.isRecording) {
      // Resume transcription when mic is re-enabled
      console.log('🎤 Microphone enabled, resuming transcription');
      
      if (!this.recognition) {
        // If recognition is null, recreate it
        console.log('🔄 Recreating speech recognition...');
        this.setupRecognition();
      }
      
      if (this.recognition) {
        console.log('🎯 Restarting speech recognition...');
        try {
          // Add a small delay to ensure mic is fully ready
          setTimeout(() => {
            if (this.recognition && this.isRecording && this.room.localParticipant?.isMicrophoneEnabled) {
              this.recognition.start();
              console.log('✅ Speech recognition restarted successfully');
            }
          }, 200);
        } catch (error) {
          console.error('❌ Failed to restart speech recognition:', error);
          // Try to recreate and restart
          setTimeout(() => {
            this.setupRecognition();
            if (this.recognition) {
              try {
                this.recognition.start();
                console.log('✅ Speech recognition recreated and restarted');
              } catch (retryError) {
                console.error('❌ Failed to recreate speech recognition:', retryError);
              }
            }
          }, 500);
        }
      }
    }
  }

  // Method to reset speaker mappings (for compatibility)
  resetSpeakerMappings(): void {
    this.activeSpeakers.clear();
    this.currentSpeaker = 'Unknown';
    this.currentSpeakerIdentity = 'unknown';
  }

  // Method to check if transcription is actually recording
  isActivelyRecording(): boolean {
    return this.isRecording && !!this.recognition;
  }

  // Method to get current status for debugging
  getStatus(): {
    isRecording: boolean;
    hasRecognition: boolean;
    microphoneEnabled: boolean;
    currentSpeaker: string;
  } {
    return {
      isRecording: this.isRecording,
      hasRecognition: !!this.recognition,
      microphoneEnabled: this.room.localParticipant?.isMicrophoneEnabled ?? false,
      currentSpeaker: this.currentSpeaker
    };
  }

  // Helper method to check if Speech Recognition is supported
  static isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  // Helper method to get browser support info
  static getBrowserSupport(): {
    supported: boolean;
    browser: string;
    apiType: string;
  } {
    // Detect Chrome and Chromium-based browsers
    if ('webkitSpeechRecognition' in window) {
      const userAgent = navigator.userAgent;
      let browser = 'Chrome';
      
      if (userAgent.includes('Edg/')) {
        browser = 'Edge (Chromium)';
      } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg/')) {
        browser = 'Chrome';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
      } else {
        browser = 'Chromium-based browser';
      }
      
      return {
        supported: true,
        browser,
        apiType: 'webkitSpeechRecognition'
      };
    }
    
    // Standard API (future browsers)
    if ('SpeechRecognition' in window) {
      return {
        supported: true,
        browser: 'Modern Browser',
        apiType: 'SpeechRecognition'
      };
    }
    
    // Detect unsupported browsers
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    
    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari (version < 14.1 or Speech Recognition disabled)';
    } else if (userAgent.includes('Edge') && !userAgent.includes('Edg/')) {
      browser = 'Edge Legacy';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome (Speech Recognition not available)';
    }
    
    return {
      supported: false,
      browser,
      apiType: 'None'
    };
  }

  // Legacy method for compatibility
  async summarizeTranscripts(transcripts: Transcript[]): Promise<string> {
    // Simple summary for now
    const fullText = transcripts
      .map(t => `${t.speaker}: ${t.text}`)
      .join('\n');

    return `Meeting Summary:\n${fullText}`;
  }
} 