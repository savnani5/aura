'use client';

import React, { useState } from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
  LayoutContextProvider,
  useCreateLayoutContext,
  useTracks,
  usePinnedTracks,
  ControlBar,
  GridLayout,
  ParticipantTile,
  FocusLayoutContainer,
  CarouselLayout,
  FocusLayout,
  ConnectionStateToast,
  RoomAudioRenderer
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  Track
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { TranscriptTab } from '@/app/components/MeetingAssitant';
import { TranscriptionService, Transcript } from '@/lib/transcription-service';
import { isEqualTrackRef, isTrackReference, isWeb } from '@livekit/components-core';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: 'Guest',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          roomName={props.roomName}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  roomName: string;
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [meetingUrl, setMeetingUrl] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(400);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

  // Mobile detection
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Countdown timer effect
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showShareModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setShowShareModal(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showShareModal, countdown]);

  // Handle resize functionality
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = Math.min(600, window.innerWidth * 0.5);
      
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);
  const transcriptionService = React.useMemo(() => new TranscriptionService(room), [room]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    
    // Show share modal when host connects
    const handleConnected = () => {
      console.log('✅ Connected to room:', room.name);
      setIsConnected(true);
      
      // Set the meeting URL for sharing
      const currentUrl = window.location.href;
      setMeetingUrl(currentUrl);
      
      // Show share modal automatically when connected (with a small delay for better UX)
      setTimeout(() => {
        setShowShareModal(true);
        setCountdown(10); // Set 10 second countdown
        
        // Auto-close the modal after 10 seconds (backup in case countdown fails)
        setTimeout(() => {
          setShowShareModal(false);
        }, 10000);
      }, 1500); // Show after 1.5 seconds to let the UI settle
      
      // Start a meeting record when successfully connected
      const startMeeting = async () => {
        try {
          console.log('🚀 Starting meeting record...');
          
          const userName = localStorage.getItem('meetingSettings')?.includes('participantName') 
            ? JSON.parse(localStorage.getItem('meetingSettings') || '{}').participantName 
            : 'Guest';
          
          const response = await fetch('/api/meetings/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomName: props.roomName,
              roomId: props.roomName, // Use roomName as roomId for now
              participantName: userName,
              title: `Meeting in ${props.roomName}`,
              type: 'Meeting'
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const meetingId = data.data.meetingId;
            console.log('✅ Meeting started with ID:', meetingId);
            
            // Store meeting ID for later use
            localStorage.setItem(`meeting-id-${props.roomName}`, meetingId);
          } else {
            console.error('❌ Failed to start meeting record:', await response.text());
          }
        } catch (error) {
          console.error('Error starting meeting:', error);
        }
      };
      
      startMeeting();
    };
    
    room.on(RoomEvent.Connected, handleConnected);
    
    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
      room.off(RoomEvent.Connected, handleConnected);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const router = useRouter();
  const handleMeetingEnd = async (transcripts: Transcript[]) => {
    try {
      console.log('🔍 MEETING END DEBUG: Starting handleMeetingEnd with transcripts:', {
        transcriptCount: transcripts.length,
        transcripts: transcripts.map((t, i) => ({
          index: i,
          speaker: t.speaker,
          text: t.text.substring(0, 100) + (t.text.length > 100 ? '...' : ''),
          timestamp: new Date(t.timestamp).toLocaleString(),
          timestampRaw: t.timestamp
        }))
      });

      // Get the meetingId from localStorage
      const meetingId = localStorage.getItem(`meeting-id-${props.roomName}`);
      
      if (!meetingId) {
        console.warn('No meetingId found for room:', props.roomName);
        // If we have transcripts, try to generate local summary as fallback
        if (transcripts.length > 0) {
          const summary = await transcriptionService.summarizeTranscripts(transcripts);
          console.log('Meeting Summary (local):', summary);
        }
        // Still redirect to home
        router.push('/');
        return;
      }

      console.log('🔚 Ending meeting with transcripts...', { meetingId, transcriptCount: transcripts.length });

      const formattedTranscripts = transcripts.map(t => ({
        speaker: t.speaker,
        text: t.text,
        timestamp: t.timestamp
      }));

      console.log('🔍 MEETING END DEBUG: Formatted transcripts for API:', formattedTranscripts);

      // Call the meeting end API
      const response = await fetch(`/api/meetings/${props.roomName}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          transcripts: formattedTranscripts,
          participants: Array.from(room.remoteParticipants.values()).map(p => ({
            name: p.name || p.identity,
            joinedAt: new Date().toISOString(), // Approximate
            leftAt: new Date().toISOString(),
            isHost: false
          })).concat([{
            name: 'Host', // Current user
            joinedAt: new Date().toISOString(),
            leftAt: new Date().toISOString(),
            isHost: true
          }]),
          endedAt: new Date().toISOString()
        }),
      });

      console.log('🔍 MEETING END DEBUG: API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Meeting ended successfully:', data);
        
        // Clean up localStorage
        localStorage.removeItem(`meeting-id-${props.roomName}`);
        
        // Disconnect from the room before redirecting
        if (room.state === 'connected') {
          await room.disconnect();
        }
        
        // Redirect to meeting room dashboard for room meetings
        if (data.data?.redirectUrl) {
          router.push(data.data.redirectUrl);
        } else {
          router.push(`/meetingroom/${props.roomName}`);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Error ending meeting:', errorData);
        // Disconnect and fallback redirect
        if (room.state === 'connected') {
          await room.disconnect();
        }
        router.push('/');
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      // Disconnect and fallback redirect
      try {
        if (room.state === 'connected') {
          await room.disconnect();
        }
      } catch (disconnectError) {
        console.error('Error disconnecting from room:', disconnectError);
      }
      router.push('/');
    }
  };

  // Store shared transcripts globally for meeting end
  const [sharedTranscripts, setSharedTranscripts] = React.useState<Transcript[]>([]);
  
  // Use ref to preserve transcripts during room cleanup
  const transcriptsRef = React.useRef<Transcript[]>([]);
  
  // Update ref whenever transcripts change
  React.useEffect(() => {
    transcriptsRef.current = sharedTranscripts;
  }, [sharedTranscripts]);

  // Add debugging for transcript changes
  React.useEffect(() => {
    console.log('🔍 TRANSCRIPT DEBUG: sharedTranscripts updated', {
      count: sharedTranscripts.length,
      transcripts: sharedTranscripts.map((t, i) => ({
        index: i,
        speaker: t.speaker,
        text: t.text.substring(0, 50) + (t.text.length > 50 ? '...' : ''),
        timestamp: new Date(t.timestamp).toLocaleTimeString()
      }))
    });
  }, [sharedTranscripts]);

  const handleOnLeave = React.useCallback(async () => {
    console.log('🚪 User leaving room - implementing immediate exit...');
    
    // Get transcripts immediately before any disconnection
    const finalTranscripts = transcriptsRef.current;
    console.log('🔍 TRANSCRIPT DEBUG: Final transcript count:', finalTranscripts.length);
    
    // Get meeting ID for background processing
    const meetingId = localStorage.getItem(`meeting-id-${props.roomName}`);
    
    // Immediately disconnect and redirect - don't wait for transcript processing
    try {
      // Stop transcription service immediately to prevent new data
      if (transcriptionService && room.state === 'connected') {
        console.log('🛑 Stopping transcription service immediately...');
        transcriptionService.stopTranscription();
      }
      
      if (room.state === 'connected') {
        console.log('🔌 Disconnecting from room immediately...');
        await room.disconnect();
      }
    } catch (error) {
      console.error('Error during immediate disconnect:', error);
    }

    // Redirect immediately to dashboard - don't wait for transcript processing
    console.log('🏃 Redirecting immediately to dashboard...');
    router.push(`/meetingroom/${props.roomName}`);

    // Process transcripts in background asynchronously (fire and forget)
    if (finalTranscripts.length > 0 && meetingId) {
      console.log('🔄 Starting background transcript processing...');
      
      // Process meeting end in background without blocking the UI
      processTranscriptsInBackground(finalTranscripts, meetingId, props.roomName)
        .then(() => {
          console.log('✅ Background transcript processing completed');
        })
        .catch((error) => {
          console.error('❌ Background transcript processing failed:', error);
        });
    } else {
      console.log('🔍 No transcripts or meeting ID to process in background');
    }
  }, [router, room, props.roomName]);

  // Background transcript processing function
  const processTranscriptsInBackground = async (transcripts: Transcript[], meetingId: string, roomName: string) => {
    console.log('🔄 Processing transcripts in background...', { meetingId, transcriptCount: transcripts.length });
    
    const formattedTranscripts = transcripts.map(t => ({
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp
    }));

    // Call the meeting end API
    const response = await fetch(`/api/meetings/${roomName}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId,
        transcripts: formattedTranscripts,
        participants: Array.from(room.remoteParticipants.values()).map(p => ({
          name: p.name || p.identity,
          joinedAt: new Date().toISOString(),
          leftAt: new Date().toISOString(),
          isHost: false
        })).concat([{
          name: 'Host',
          joinedAt: new Date().toISOString(),
          leftAt: new Date().toISOString(),
          isHost: true
        }]),
        endedAt: new Date().toISOString()
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Background processing: Meeting ended successfully:', data);
      
      // Clean up localStorage
      localStorage.removeItem(`meeting-id-${roomName}`);
      
      return data;
    } else {
      const errorData = await response.json();
      console.error('❌ Background processing: Error ending meeting:', errorData);
      throw new Error(errorData.message || 'Failed to process meeting end');
    }
  };

  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join my Ohm video meeting');
    const body = encodeURIComponent(`Hi! Join my video meeting on Ohm:\n\n${meetingUrl}\n\nSee you there!`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Join my video meeting on Ohm: ${meetingUrl}`);
    window.open(`https://wa.me/?text=${text}`);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setCopied(false);
    setCountdown(0);
  };

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <div 
          className="lk-video-conference" 
          style={{ 
            display: 'flex', 
            width: '100%', 
            height: '100%',
            flexDirection: isMobile ? 'column' : 'row'
          }}
        >
          <div 
            className="lk-main-content" 
            style={{ 
              flex: 1, 
              minWidth: 0,
              height: isMobile ? 'calc(100vh - 50vh)' : '100%',
              minHeight: isMobile ? '50vh' : 'auto'
            }}
          >
            <CustomVideoConference
              SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
            />
          </div>
          {!isMobile && (
            <div className="lk-sidebar" style={{ width: sidebarWidth, minWidth: 300, maxWidth: 600, position: 'relative' }}>
              <div 
                className="resize-handle"
                onMouseDown={handleMouseDown}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  cursor: 'ew-resize',
                  backgroundColor: 'transparent',
                  zIndex: 10,
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  if (!isResizing) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              />
              <TranscriptTab onTranscriptsChange={setSharedTranscripts} />
            </div>
          )}
          {isMobile && (
            <TranscriptTab onTranscriptsChange={setSharedTranscripts} />
          )}
        </div>
        
        {/* Share Link Modal */}
        {showShareModal && (
          <div className="share-modal-overlay" onClick={closeShareModal}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="share-modal-header">
                <div className="share-modal-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="share-modal-title">Share Meeting Link</h3>
                  <p className="share-modal-subtitle">Invite participants to join</p>
                </div>
                <button onClick={closeShareModal} className="share-modal-close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div className="share-modal-content">
                <div className="share-link-container">
                  <div className="share-link-box">
                    <input
                      type="text"
                      value={meetingUrl}
                      readOnly
                      className="share-link-input"
                    />
                    <button onClick={copyToClipboard} className="share-copy-button">
                      {copied ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="share-options">
                  <p className="share-options-title">Quick Share:</p>
                  <div className="share-buttons">
                    <button onClick={shareViaEmail} className="share-button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Email
                    </button>
                    <button onClick={shareViaWhatsApp} className="share-button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      WhatsApp
                    </button>
                  </div>
                </div>

                {e2eeEnabled && (
                  <div className="share-encryption-notice">
                    <div className="share-encryption-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
                        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="share-encryption-title">End-to-end encryption enabled</p>
                      <p className="share-encryption-description">
                        Participants will need the encryption passphrase to join.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="share-modal-footer">
                  <p className="share-modal-timer">
                    {countdown > 0 ? `This popup will close automatically in ${countdown} seconds` : 'This popup will close automatically in a few seconds'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <KeyboardShortcuts />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}

// Custom VideoConference component without chat
function CustomVideoConference({ SettingsComponent, ...props }: { SettingsComponent?: React.ComponentType }) {
  const [widgetState, setWidgetState] = React.useState({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<any>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: any) => {
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track: any) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track: any) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    // Auto focus screen share
    if (
      screenShareTracks.some((track: any) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track: any) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr: any) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks
      .map((ref: any) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
    layoutContext.pin
  ]);

  return (
    <div className="lk-video-conference" {...props}>
      {isWeb() && (
        <LayoutContextProvider
          value={layoutContext}
          onWidgetChange={widgetUpdate}
        >
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  {focusTrack && <FocusLayout trackRef={focusTrack} />}
                </FocusLayoutContainer>
              </div>
            )}
            <ControlBar controls={{ chat: false, settings: !!SettingsComponent }} />
          </div>
          {SettingsComponent && (
            <div
              className="lk-settings-menu-modal"
              style={{ display: widgetState.showSettings ? 'block' : 'none' }}
            >
              <SettingsComponent />
            </div>
          )}
        </LayoutContextProvider>
      )}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
