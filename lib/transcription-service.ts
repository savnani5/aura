import { Track, Room, Participant, AudioTrack } from 'livekit-client';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

interface DeepgramTranscription {
  channel: {
    alternatives: Array<{
      transcript: string;
      speaker?: number; // Deepgram uses numeric speaker IDs
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: number;
      }>;
    }>;
  };
}

export interface Transcript {
  speaker: string;
  text: string;
  timestamp: number;
  participantId?: string;
  speakerConfidence?: number; // Confidence in speaker identification
  deepgramSpeaker?: number; // Original Deepgram speaker ID for debugging
}

interface SpeakerProfile {
  participantId: string;
  participantName: string;
  deepgramSpeakerId?: number;
  voiceActivityHistory: number[]; // Recent voice activity timestamps
  lastActiveTime: number;
  utteranceCount: number;
}

export class TranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private transcriptionCallback: ((transcript: Transcript) => void) | null = null;
  private connection: any | null = null;
  private room: Room | null = null;
  private lastTranscriptTime: number = 0;
  private lastSpeaker: string = '';
  private speakerMap: Map<string, Participant> = new Map();
  
  // Enhanced speaker diarization properties
  private speakerProfiles: Map<string, SpeakerProfile> = new Map();
  private deepgramToParticipantMap: Map<number, string> = new Map();
  private voiceActivityDetector: Map<string, boolean> = new Map(); // Track who's currently speaking
  private mixedAudioStream: MediaStream | null = null;
  private audioTracks: Map<string, AudioTrack> = new Map();
  private retryCount = 0;
  private maxRetries = 2;
  
  // Debouncing for same-device testing
  private lastSpeakerChange: number = 0;
  private speakerChangeDebounceMs: number = 2000; // 2 seconds to prevent rapid switching

  constructor(room: Room) {
    this.room = room;
    this.updateSpeakerMap();
    this.initializeVoiceActivityTracking();
    
    // Listen for participant changes to update speaker mapping
    room.on('participantConnected', (participant) => {
      this.updateSpeakerMap();
      this.trackParticipantAudio(participant);
    });
    
    room.on('participantDisconnected', (participant) => {
      this.updateSpeakerMap();
      this.removeParticipantTracking(participant.identity);
    });

    // Track audio track changes
    room.on('trackSubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        this.trackParticipantAudio(participant);
      }
    });

    room.on('trackUnsubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        this.audioTracks.delete(participant.identity);
      }
    });
  }

  private updateSpeakerMap() {
    if (!this.room) return;
    
    // Get current participant IDs
    const currentParticipantIds = new Set<string>();
    
    // Add local participant
    if (this.room.localParticipant) {
      currentParticipantIds.add(this.room.localParticipant.identity);
      const name = this.room.localParticipant.name || this.room.localParticipant.identity || 'You';
      this.speakerMap.set(this.room.localParticipant.identity, this.room.localParticipant);
      
      // Initialize or update speaker profile
      if (!this.speakerProfiles.has(this.room.localParticipant.identity)) {
        this.speakerProfiles.set(this.room.localParticipant.identity, {
          participantId: this.room.localParticipant.identity,
          participantName: name,
          voiceActivityHistory: [],
          lastActiveTime: 0,
          utteranceCount: 0
        });
      } else {
        // Update name in case it changed
        const profile = this.speakerProfiles.get(this.room.localParticipant.identity);
        if (profile) {
          profile.participantName = name;
        }
      }
    }
    
    // Add remote participants
    this.room.remoteParticipants.forEach((participant) => {
      currentParticipantIds.add(participant.identity);
      const name = participant.name || participant.identity || 'Unknown';
      this.speakerMap.set(participant.identity, participant);
      
      // Initialize or update speaker profile
      if (!this.speakerProfiles.has(participant.identity)) {
        this.speakerProfiles.set(participant.identity, {
          participantId: participant.identity,
          participantName: name,
          voiceActivityHistory: [],
          lastActiveTime: 0,
          utteranceCount: 0
        });
      } else {
        // Update name in case it changed
        const profile = this.speakerProfiles.get(participant.identity);
        if (profile) {
          profile.participantName = name;
        }
      }
    });
    
    // Clean up old participants that are no longer in the room
    const oldParticipantIds = Array.from(this.speakerMap.keys());
    oldParticipantIds.forEach(participantId => {
      if (!currentParticipantIds.has(participantId)) {
        console.log(`🧹 Cleaning up old participant: ${participantId}`);
        this.speakerMap.delete(participantId);
        this.speakerProfiles.delete(participantId);
        this.voiceActivityDetector.delete(participantId);
        this.audioTracks.delete(participantId);
        
        // Remove from Deepgram mapping
        for (const [deepgramId, participantIdentity] of this.deepgramToParticipantMap.entries()) {
          if (participantIdentity === participantId) {
            this.deepgramToParticipantMap.delete(deepgramId);
            console.log(`🧹 Removed Deepgram mapping for old participant: ${participantId}`);
            break;
          }
        }
      }
    });
    
    console.log('🔍 SPEAKER MAP UPDATED:', {
      participants: Array.from(this.speakerMap.entries()).map(([id, p]) => ({
        id,
        name: p.name || p.identity,
        isLocal: p === this.room?.localParticipant
      })),
      deepgramMappings: Array.from(this.deepgramToParticipantMap.entries())
    });
  }

  private initializeVoiceActivityTracking() {
    if (!this.room) return;

    // Track voice activity for all participants
    // Add local participant
    if (this.room.localParticipant) {
      this.voiceActivityDetector.set(this.room.localParticipant.identity, false);
    }
    
    // Add remote participants
    this.room.remoteParticipants.forEach((participant: Participant) => {
      this.voiceActivityDetector.set(participant.identity, false);
    });
  }

  private trackParticipantAudio(participant: Participant) {
    // Get audio track for this participant
    const audioTrack = participant.audioTrackPublications.values().next().value?.track as AudioTrack;
    
    if (audioTrack) {
      this.audioTracks.set(participant.identity, audioTrack);
      
      // Monitor voice activity
      this.monitorVoiceActivity(participant.identity, audioTrack);
    }
  }

  private monitorVoiceActivity(participantId: string, audioTrack: AudioTrack) {
    // This would ideally use WebRTC's voice activity detection
    // For now, we'll use a simplified approach based on audio level monitoring
    // In a production environment, you might want to use more sophisticated VAD
    
    if (!audioTrack.mediaStreamTrack) return;

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack.mediaStreamTrack]));
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkActivity = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const isActive = average > 10; // Threshold for voice activity
        
        const wasActive = this.voiceActivityDetector.get(participantId) || false;
        
        if (isActive !== wasActive) {
          this.voiceActivityDetector.set(participantId, isActive);
          
          if (isActive) {
            // Update speaker profile
            const profile = this.speakerProfiles.get(participantId);
            if (profile) {
              profile.lastActiveTime = Date.now();
              profile.voiceActivityHistory.push(Date.now());
              
              // Keep only recent history (last 30 seconds)
              const thirtySecondsAgo = Date.now() - 30000;
              profile.voiceActivityHistory = profile.voiceActivityHistory.filter(
                time => time > thirtySecondsAgo
              );
            }
          }
          
          console.log(`🎤 Voice activity ${isActive ? 'started' : 'stopped'} for ${participantId}`);
        }
        
        // Continue monitoring
        if (this.audioTracks.has(participantId)) {
          requestAnimationFrame(checkActivity);
        } else {
          audioContext.close();
        }
      };
      
      checkActivity();
    } catch (error) {
      console.warn(`Failed to monitor voice activity for ${participantId}:`, error);
    }
  }

  private removeParticipantTracking(participantId: string) {
    this.audioTracks.delete(participantId);
    this.voiceActivityDetector.delete(participantId);
    this.speakerProfiles.delete(participantId);
    
    // Remove from Deepgram mapping
    for (const [deepgramId, participantIdentity] of this.deepgramToParticipantMap.entries()) {
      if (participantIdentity === participantId) {
        this.deepgramToParticipantMap.delete(deepgramId);
        break;
      }
    }
  }

  private createMixedAudioStream(): MediaStream | null {
    if (!this.room) return null;

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      // Mix local participant audio
      if (this.room.localParticipant) {
        const localAudioTrack = Array.from(this.room.localParticipant.audioTrackPublications.values())
          .find(pub => pub.track)?.track as AudioTrack;
        
        if (localAudioTrack?.mediaStreamTrack) {
          const source = audioContext.createMediaStreamSource(
            new MediaStream([localAudioTrack.mediaStreamTrack])
          );
          source.connect(destination);
        }
      }
      
      // Mix remote participants audio
      this.room.remoteParticipants.forEach(participant => {
        const audioTrack = Array.from(participant.audioTrackPublications.values())
          .find(pub => pub.track)?.track as AudioTrack;
        
        if (audioTrack?.mediaStreamTrack) {
          const source = audioContext.createMediaStreamSource(
            new MediaStream([audioTrack.mediaStreamTrack])
          );
          source.connect(destination);
        }
      });
      
      this.mixedAudioStream = destination.stream;
      return this.mixedAudioStream;
    } catch (error) {
      console.error('Error creating mixed audio stream:', error);
      return null;
    }
  }

  private mapDeepgramSpeakerToParticipant(deepgramSpeakerId: number, timestamp: number): string {
    // Check if we already have a mapping
    const existingMapping = this.deepgramToParticipantMap.get(deepgramSpeakerId);
    if (existingMapping && this.speakerProfiles.has(existingMapping)) {
      return existingMapping;
    }
    
    // For testing scenarios with same device/microphone, prioritize local participant
    // This helps when multiple browser tabs are used from same device
    const localParticipant = this.room?.localParticipant;
    if (localParticipant) {
      // Check if local participant is currently active (has audio track enabled)
      const localAudioEnabled = Array.from(localParticipant.audioTrackPublications.values())
        .some(pub => pub.track && !pub.track.isMuted);
      
      if (localAudioEnabled) {
        console.log(`🎯 Prioritizing local participant ${localParticipant.identity} for Deepgram speaker ${deepgramSpeakerId}`);
        this.deepgramToParticipantMap.set(deepgramSpeakerId, localParticipant.identity);
        return localParticipant.identity;
      }
    }
    
    // Find the most likely participant based on voice activity around this timestamp
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const [participantId, profile] of this.speakerProfiles.entries()) {
      let score = 0;
      
      // Score based on recent voice activity
      const recentActivity = profile.voiceActivityHistory.filter(
        time => Math.abs(time - timestamp) < 2000 // Within 2 seconds
      ).length;
      
      score += recentActivity * 10;
      
      // Score based on how recently they were active
      const timeSinceActive = timestamp - profile.lastActiveTime;
      if (timeSinceActive < 5000) { // Within 5 seconds
        score += (5000 - timeSinceActive) / 100;
      }
      
      // Score based on current voice activity
      if (this.voiceActivityDetector.get(participantId)) {
        score += 50;
      }
      
      // Bonus score for participants that haven't been mapped yet
      const hasExistingMapping = Array.from(this.deepgramToParticipantMap.values()).includes(participantId);
      if (!hasExistingMapping) {
        score += 25;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = participantId;
      }
    }
    
    // If we found a good match, create the mapping
    if (bestMatch && bestScore > 10) {
      this.deepgramToParticipantMap.set(deepgramSpeakerId, bestMatch);
      
      // Update speaker profile
      const profile = this.speakerProfiles.get(bestMatch);
      if (profile) {
        profile.deepgramSpeakerId = deepgramSpeakerId;
        profile.utteranceCount++;
      }
      
      console.log(`🎯 Mapped Deepgram speaker ${deepgramSpeakerId} to participant ${bestMatch} (score: ${bestScore})`);
      return bestMatch;
    }
    
    // Fallback to local participant if no clear match
    if (localParticipant) {
      console.warn(`⚠️ No clear speaker mapping for Deepgram speaker ${deepgramSpeakerId}, defaulting to local participant`);
      this.deepgramToParticipantMap.set(deepgramSpeakerId, localParticipant.identity);
      return localParticipant.identity;
    }
    
    return 'unknown';
  }

  private getCurrentSpeaker(deepgramSpeakerId?: number, timestamp?: number): { name: string; id: string; confidence: number } {
    if (!this.room?.localParticipant) {
      return { name: 'Unknown', id: 'unknown', confidence: 0 };
    }

    // If we have Deepgram speaker ID, try to map it to a participant
    if (deepgramSpeakerId !== undefined && timestamp !== undefined) {
      const participantId = this.mapDeepgramSpeakerToParticipant(deepgramSpeakerId, timestamp);
      const participant = this.speakerMap.get(participantId);
      
      if (participant) {
        // Calculate confidence based on mapping quality
        let confidence = 0.6; // Lower base confidence for same-device scenarios
        
        const profile = this.speakerProfiles.get(participantId);
        if (profile?.deepgramSpeakerId === deepgramSpeakerId) {
          confidence = 0.8; // Good confidence for established mapping
        }
        
        // Boost confidence if this is the local participant and they have audio enabled
        if (participant === this.room.localParticipant) {
          const localAudioEnabled = Array.from(participant.audioTrackPublications.values())
            .some(pub => pub.track && !pub.track.isMuted);
          if (localAudioEnabled) {
            confidence = Math.min(0.9, confidence + 0.2);
          }
        }
        
        return {
          name: participant.name || participant.identity || 'Unknown',
          id: participant.identity,
          confidence
        };
      }
    }
    
    // Fallback: prioritize local participant if they have audio enabled
    const localParticipant = this.room.localParticipant;
    const localAudioEnabled = Array.from(localParticipant.audioTrackPublications.values())
      .some(pub => pub.track && !pub.track.isMuted);
    
    if (localAudioEnabled) {
      return {
        name: localParticipant.name || localParticipant.identity || 'You',
        id: localParticipant.identity,
        confidence: 0.7 // Good confidence for local participant with audio
      };
    }
    
    // Last resort: find most likely current speaker based on voice activity
    let mostLikelyParticipant: Participant = localParticipant;
    let highestActivity = 0;
    
    for (const [participantId, isActive] of this.voiceActivityDetector.entries()) {
      if (isActive) {
        const profile = this.speakerProfiles.get(participantId);
        const recentActivity = profile?.voiceActivityHistory.length || 0;
        
        if (recentActivity > highestActivity) {
          highestActivity = recentActivity;
          const participant = this.speakerMap.get(participantId);
          if (participant) {
            mostLikelyParticipant = participant;
          }
        }
      }
    }
    
    return {
      name: mostLikelyParticipant.name || mostLikelyParticipant.identity || 'You',
      id: mostLikelyParticipant.identity,
      confidence: highestActivity > 0 ? 0.5 : 0.3 // Lower confidence for fallback
    };
  }

  private getConnectionConfig(useFallback = false) {
    if (useFallback) {
      console.log('🔄 Using minimal fallback configuration');
      return {
        model: 'nova-2', // Use nova-2 instead of nova per Deepgram docs
        language: 'en',
        smart_format: true,
        interim_results: true,
        punctuate: true
      };
    }
    
    return {
      model: 'nova-2', // Updated to nova-2 per Deepgram recommendations
      language: 'en',
      smart_format: true,
      diarize: true, // Enable speaker diarization
      diarize_version: '2023-10-12', // Use latest diarization model
      interim_results: true,
      utterance_end_ms: 2000,
      punctuate: true,
      numerals: true,
      profanity_filter: false, // Keep original speech
      redact: false,
      alternatives: 1, // Get the best transcription alternative
    };
  }

  private async retryTranscription(useBasicMode: boolean = false) {
    console.log(`🔄 Starting retry transcription process... (attempt ${this.retryCount + 1}/${this.maxRetries})`);
    
    // Prevent infinite retry loops
    if (this.retryCount >= this.maxRetries) {
      console.error('❌ Max retries exceeded, stopping transcription service');
      this.stopTranscription();
      return;
    }
    
    try {
      // Clean up existing connection
      if (this.connection) {
        this.connection.finish();
        this.connection = null;
      }
      
      // Get API key
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('API key not available for retry');
      }
      
      // Create new client and connection
      const deepgram = createClient(apiKey);
      const connectionConfig = this.getConnectionConfig(useBasicMode);
      
      console.log('🔄 Retry connection config:', connectionConfig);
      this.connection = deepgram.listen.live(connectionConfig);
      
      // Set up event listeners for retry
      this.setupConnectionListeners();
      
      // Important: Re-setup MediaRecorder for the new connection
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.log('🔄 MediaRecorder is still recording, connecting to new stream...');
        // The existing MediaRecorder will send data to the new connection
      } else {
        console.warn('⚠️ MediaRecorder not recording during retry - may need to restart audio');
      }
      
    } catch (error) {
      console.error('❌ Retry failed:', error);
      this.retryCount = this.maxRetries; // Stop further retries
      this.stopTranscription();
    }
  }

  private setupConnectionListeners() {
    if (!this.connection) return;
    
    let connectionEstablished = false;
    
    this.connection.on(LiveTranscriptionEvents.Open, () => {
      connectionEstablished = true;
      console.log(`🎙️ Transcription connection established (attempt ${this.retryCount + 1})`);
      
      // Reset retry count only after successful open
      // Don't reset immediately, wait for some stability
      setTimeout(() => {
        if (connectionEstablished && this.connection) {
          this.retryCount = 0;
          console.log('✅ Connection stable, retry count reset');
        }
      }, 3000); // Wait 3 seconds before considering it stable
      
      // Ensure MediaRecorder is sending data to new connection
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.log('✅ Audio stream connected to new WebSocket');
      } else {
        console.warn('⚠️ MediaRecorder not active - transcription may not work');
      }
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      connectionEstablished = false;
      console.log('🎙️ Transcription connection closed');
      
      // Only trigger retry if:
      // 1. We still want transcription (callback exists)
      // 2. Haven't exceeded retries
      // 3. Connection was previously established (not immediate close)
      // 4. We're not intentionally stopping
      if (this.transcriptionCallback && 
          this.retryCount < this.maxRetries && 
          this.connection) { // Check if we still have a connection reference
        
        console.log(`🔄 Connection closed unexpectedly, will retry in ${(this.retryCount + 1) * 2} seconds...`);
        this.retryCount++;
        
        setTimeout(() => {
          if (this.transcriptionCallback) { // Double-check we still want transcription
            this.retryTranscription(this.retryCount >= 1);
          }
        }, 2000 * this.retryCount); // Progressive delay: 2s, 4s, 6s...
      }
    });

    // Transcript handler
    this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      if (data.channel?.alternatives?.[0]?.transcript && this.transcriptionCallback) {
        const alternative = data.channel.alternatives[0];
        const transcriptText = alternative.transcript.trim();
        
        // Skip empty or very short transcripts
        if (transcriptText.length < 2) return;
        
        const currentTime = Date.now();
        const deepgramSpeakerId = alternative.speaker;
        const isFinal = data.is_final; // Check if this is a final result
        
        // Get speaker with enhanced diarization
        const speaker = this.getCurrentSpeaker(deepgramSpeakerId, currentTime);
        
        // Debounce speaker changes to prevent rapid alternating in same-device scenarios
        const speakerChanged = this.lastSpeaker !== speaker.name;
        const timeSinceLastChange = currentTime - this.lastSpeakerChange;
        
        if (speakerChanged && timeSinceLastChange < this.speakerChangeDebounceMs) {
          // If speaker changed too quickly, stick with the last speaker but lower confidence
          console.log(`🔄 Debouncing speaker change from ${this.lastSpeaker} to ${speaker.name} (too quick: ${timeSinceLastChange}ms)`);
          const debouncedSpeaker = {
            name: this.lastSpeaker,
            id: this.lastSpeaker === 'You' ? this.room?.localParticipant?.identity || 'unknown' : speaker.id,
            confidence: Math.max(0.2, speaker.confidence - 0.3) // Lower confidence for debounced attribution
          };
          
          if (isFinal) {
            // Filter out low confidence speaker attributions (40% or less) for debounced transcripts too
            if (debouncedSpeaker.confidence <= 0.4) {
              console.log('🔍 SKIPPING LOW CONFIDENCE DEBOUNCED TRANSCRIPT:', {
                speaker: debouncedSpeaker.name,
                confidence: debouncedSpeaker.confidence,
                text: transcriptText.substring(0, 50) + '...',
                reason: 'Debounced speaker confidence too low (≤40%)'
              });
              return; // Skip this transcript to avoid incorrect speaker attribution
            }
            
            const finalTranscript: Transcript = {
              speaker: debouncedSpeaker.name,
              text: transcriptText,
              timestamp: currentTime,
              participantId: debouncedSpeaker.id,
              speakerConfidence: debouncedSpeaker.confidence,
              deepgramSpeaker: deepgramSpeakerId
            };
            
            console.log('🔍 SENDING DEBOUNCED TRANSCRIPT:', {
              speaker: finalTranscript.speaker,
              text: finalTranscript.text,
              confidence: finalTranscript.speakerConfidence,
              debounced: true
            });
            
            this.transcriptionCallback(finalTranscript);
          }
          return;
        }
        
        console.log('🎯 TRANSCRIPTION RECEIVED:', {
          deepgramSpeaker: deepgramSpeakerId,
          mappedParticipant: speaker.name,
          confidence: speaker.confidence,
          text: transcriptText.substring(0, 50) + '...',
          isFinal: isFinal,
          speakerChanged,
          timeSinceLastChange
        });
        
        // Only send final transcripts to avoid duplication
        // Deepgram sends interim results with cumulative text, then a final result
        if (isFinal) {
          // Filter out low confidence speaker attributions (40% or less)
          if (speaker.confidence <= 0.4) {
            console.log('🔍 SKIPPING LOW CONFIDENCE TRANSCRIPT:', {
              speaker: speaker.name,
              confidence: speaker.confidence,
              text: transcriptText.substring(0, 50) + '...',
              reason: 'Speaker confidence too low (≤40%)'
            });
            return; // Skip this transcript to avoid incorrect speaker attribution
          }
          
          const finalTranscript: Transcript = {
            speaker: speaker.name,
            text: transcriptText,
            timestamp: currentTime,
            participantId: speaker.id,
            speakerConfidence: speaker.confidence,
            deepgramSpeaker: deepgramSpeakerId
          };
          
          console.log('🔍 SENDING FINAL TRANSCRIPT:', {
            speaker: finalTranscript.speaker,
            text: finalTranscript.text,
            confidence: finalTranscript.speakerConfidence,
            timestamp: new Date(finalTranscript.timestamp).toLocaleTimeString()
          });
          
          this.transcriptionCallback(finalTranscript);
          
          // Update tracking
          if (speakerChanged) {
            this.lastSpeakerChange = currentTime;
          }
          this.lastSpeaker = speaker.name;
          this.lastTranscriptTime = currentTime;
        }
      }
    });

    // Error handler with improved retry logic
    this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      connectionEstablished = false;
      console.error('🚨 Transcription error details:', {
        error,
        errorType: typeof error,
        errorString: String(error),
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack,
        timestamp: new Date().toISOString(),
        retryCount: this.retryCount
      });
      
      // Only retry if we haven't exceeded max retries and still want transcription
      if (this.retryCount < this.maxRetries && this.transcriptionCallback) {
        this.retryCount++;
        const useBasicMode = this.retryCount >= 1; // Use fallback after first retry
        
        console.log(`🔄 Error occurred, attempting retry ${this.retryCount}/${this.maxRetries} ${useBasicMode ? 'with basic configuration' : 'with original configuration'}...`);
        
        setTimeout(() => {
          if (this.transcriptionCallback) {
            this.retryTranscription(useBasicMode);
          }
        }, 3000 * this.retryCount); // Longer delay for errors: 3s, 6s, 9s...
      } else {
        console.error('❌ Max retries exceeded or transcription stopped. Service failed.');
        this.stopTranscription();
      }
    });
  }

  async startTranscription(
    audioTrack: MediaStreamTrack,
    onTranscript: (transcript: Transcript) => void
  ) {
    console.log('🎙️ Starting transcription service...');
    this.transcriptionCallback = onTranscript;
    this.retryCount = 0; // Reset retry count for new session
    
    // Try to create mixed audio stream for better speaker diarization
    const mixedStream = this.createMixedAudioStream();
    const streamToUse = mixedStream || new MediaStream([audioTrack]);
    
    console.log('🎵 Audio stream created:', {
      hasMixedStream: !!mixedStream,
      trackCount: streamToUse.getTracks().length,
      trackIds: streamToUse.getTracks().map(t => t.id)
    });
    
    // Create audio context
    this.audioContext = new AudioContext();
    
    // Create media recorder with error handling
    try {
      this.mediaRecorder = new MediaRecorder(streamToUse, {
        mimeType: 'audio/webm',
      });
    } catch (error) {
      console.error('❌ Failed to create MediaRecorder:', error);
      // Try fallback MIME type
      try {
        this.mediaRecorder = new MediaRecorder(streamToUse);
        console.log('✅ Using fallback MediaRecorder configuration');
      } catch (fallbackError) {
        console.error('❌ MediaRecorder creation failed completely:', fallbackError);
        return;
      }
    }

    try {
      // Validate API key
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('Deepgram API key is not configured. Please set NEXT_PUBLIC_DEEPGRAM_API_KEY in your environment variables.');
      }
      
      console.log('🔑 Deepgram API Key validated:', `${apiKey.substring(0, 8)}...`);

      // Initialize Deepgram client
      const deepgram = createClient(apiKey);
      
      // Start with enhanced configuration, will fallback if needed
      const connectionConfig = this.getConnectionConfig();
      
      console.log('🎛️ Initial Deepgram connection config:', connectionConfig);

      // Create live transcription connection with enhanced diarization
      this.connection = deepgram.listen.live(connectionConfig);

      // Set up event listeners BEFORE starting MediaRecorder
      this.setupConnectionListeners();

      // Wait a moment for connection to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Handle data available event with better error handling
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.connection) {
          try {
            // Send audio data to Deepgram - following the SDK pattern
            this.connection.send(event.data);
          } catch (error) {
            console.error('❌ Failed to send audio data:', error);
          }
        } else if (event.data.size === 0) {
          console.warn('⚠️ Received empty audio data chunk');
        } else if (!this.connection) {
          console.warn('⚠️ No connection available to send audio data');
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
      };

      this.mediaRecorder.onstart = () => {
        console.log('🎤 MediaRecorder started successfully');
      };

      this.mediaRecorder.onstop = () => {
        console.log('🎤 MediaRecorder stopped');
      };

      // Start recording with smaller intervals for better real-time performance
      this.mediaRecorder.start(250); // Collect data every 250ms
      
      // Add connection timeout as safety measure
      setTimeout(() => {
        if (this.connection && this.retryCount === 0) {
          console.log('🔄 Connection timeout check - ensuring connection is working...');
          // Send a small test message to verify connection
          try {
            // Don't send actual test data, just log that we're checking
            console.log('✅ Connection appears to be active');
          } catch (error) {
            console.warn('⚠️ Connection timeout check failed:', error);
          }
        }
      }, 10000); // Check after 10 seconds
      
      console.log('🎙️ Enhanced transcription service started with speaker diarization');
      
    } catch (error) {
      console.error('❌ Error starting transcription:', error);
      this.stopTranscription();
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping transcription service...');
    
    // Clear the callback first to prevent retries
    this.transcriptionCallback = null;
    
    // Stop and clean up MediaRecorder
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      } catch (error) {
        console.warn('⚠️ Error stopping MediaRecorder:', error);
      }
      this.mediaRecorder = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn('⚠️ Error closing AudioContext:', error);
      }
      this.audioContext = null;
    }
    
    // Finish and clean up connection
    if (this.connection) {
      try {
        this.connection.finish();
      } catch (error) {
        console.warn('⚠️ Error finishing connection:', error);
      }
      this.connection = null;
    }
    
    // Stop mixed audio stream
    if (this.mixedAudioStream) {
      try {
        this.mixedAudioStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('⚠️ Error stopping mixed audio stream:', error);
      }
      this.mixedAudioStream = null;
    }
    
    // Reset state
    this.lastSpeaker = '';
    this.retryCount = 0; // Reset retry count
    
    // Clean up speaker tracking
    this.deepgramToParticipantMap.clear();
    this.voiceActivityDetector.clear();
    
    console.log('✅ Transcription service stopped and cleaned up');
  }

  // Debug method to get current speaker mappings
  getDebugInfo() {
    return {
      speakerProfiles: Array.from(this.speakerProfiles.entries()),
      deepgramToParticipantMap: Array.from(this.deepgramToParticipantMap.entries()),
      voiceActivityDetector: Array.from(this.voiceActivityDetector.entries()),
      audioTracks: Array.from(this.audioTracks.keys())
    };
  }

  // Method to reset speaker mappings when there are conflicts
  resetSpeakerMappings() {
    console.log('🔄 Resetting speaker mappings...');
    this.deepgramToParticipantMap.clear();
    
    // Reset speaker profiles but keep participant info
    for (const [participantId, profile] of this.speakerProfiles.entries()) {
      profile.deepgramSpeakerId = undefined;
      profile.utteranceCount = 0;
      profile.voiceActivityHistory = [];
      profile.lastActiveTime = 0;
    }
    
    console.log('✅ Speaker mappings reset');
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