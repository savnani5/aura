'use client';

import React, { useState } from 'react';
// Import LiveKit styles only for meeting pages
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import { decodePassphrase } from '@/lib/utils/client-utils';
import { KeyboardShortcuts, RecordingIndicator, SettingsMenu } from '@/components/meeting';
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
import { useSetupE2EE } from '@/lib/utils/e2ee-setup';
import { EnhancedControlBar } from '@/components/meeting';
import { Transcript } from '@/lib/services/transcription';
import { isEqualTrackRef, isTrackReference, isWeb } from '@livekit/components-core';
import { MeetingStorageUtils, useMeetingStore } from '@/lib/state';

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
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [roomTitle, setRoomTitle] = React.useState<string>('');

  // Fetch room title
  React.useEffect(() => {
    const fetchRoomTitle = async () => {
      try {
        const response = await fetch(`/api/meetings/${props.roomName}/history`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.length > 0) {
            const roomData = data.data[0];
            setRoomTitle(roomData.title || `Meeting Room`);
          } else {
            setRoomTitle('Meeting Room');
          }
        } else {
          setRoomTitle('Meeting Room');
        }
      } catch (error) {
        console.error('Error fetching room title:', error);
        setRoomTitle('Meeting Room');
      }
    };
    
    fetchRoomTitle();
  }, [props.roomName]);

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
    <main 
      data-theme="meeting" 
      data-lk-theme="default"
      className="fixed inset-0 overflow-hidden" 
      style={{
        background: '#000000'
      }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className="fixed inset-0 flex items-center justify-center p-8" style={{
          background: '#000000'
        }}>
          <div className="relative z-10 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 max-w-lg w-full shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Join Meeting</h1>
              <p className="text-gray-400 text-sm">{roomTitle}</p>
            </div>
            <div className="prejoin-wrapper">
              <PreJoin
                defaults={preJoinDefaults}
                onSubmit={handlePreJoinSubmit}
                onError={handlePreJoinError}
              />
            </div>
          </div>
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
  const [isConnected, setIsConnected] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

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
            : props.userChoices.username || 'Participant';
          
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
            
            // Store meeting ID in Zustand store (replaces localStorage)
            MeetingStorageUtils.setMeetingId(props.roomName, meetingId);
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

    // Add participant tracking to Zustand store
    const handleParticipantConnected = (participant: any) => {
      console.log('👥 Participant connected:', participant.identity);
      useMeetingStore.getState().addParticipant({
        id: participant.sid,
        name: participant.identity,
        email: participant.metadata ? JSON.parse(participant.metadata).email : '',
        isOnline: true,
        isHost: participant === room.localParticipant,
        joinedAt: new Date()
      });
    };

    const handleParticipantDisconnected = (participant: any) => {
      console.log('👥 Participant disconnected:', participant.identity);
      useMeetingStore.getState().updateParticipant(participant.sid, {
        isOnline: false,
        leftAt: new Date()
      });
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    
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
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
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

      // Get the meetingId from Zustand store (replaces localStorage)
      const meetingId = MeetingStorageUtils.getMeetingId(props.roomName);
      
      if (!meetingId) {
        console.warn('No meetingId found for room:', props.roomName);
        // If we have transcripts, log them
        if (transcripts.length > 0) {
          console.log('Meeting Summary (local): Transcripts available but no meetingId');
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
        
        // Clean up meeting ID from Zustand store (replaces localStorage)
        MeetingStorageUtils.removeMeetingId(props.roomName);
        
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
  
  // Add flag to prevent duplicate meeting end calls
  const meetingEndTriggeredRef = React.useRef<boolean>(false);
  
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
    console.log('🚪 MEETING END PIPELINE: handleOnLeave function called!');
    console.log('🚪 MEETING END PIPELINE: User leaving room - implementing immediate exit...');
    
    // Check if meeting end has already been triggered
    if (meetingEndTriggeredRef.current) {
      console.log('⚠️ MEETING END PIPELINE: Meeting end already triggered, skipping duplicate call');
      return;
    }
    
    // Count total participants (local + remote)
    const remoteParticipants = Array.from(room.remoteParticipants.values());
    const totalParticipants = 1 + remoteParticipants.length;
    
    console.log(`👥 MEETING END PIPELINE: Total participants: ${totalParticipants} (1 local + ${remoteParticipants.length} remote)`);
    console.log(`👥 MEETING END PIPELINE: Remote participants:`, remoteParticipants.map(p => ({
      identity: p.identity,
      name: p.name,
      sid: p.sid
    })));
    
    // Only trigger meeting end if this is the last person leaving
    let shouldEndMeeting = false;
    if (totalParticipants === 1) {
      // This is the last participant leaving
      shouldEndMeeting = true;
      console.log('👤 MEETING END PIPELINE: Last participant leaving - triggering meeting end');
    } else {
      console.log('👥 MEETING END PIPELINE: Other participants still in room - not ending meeting');
      console.log('👥 MEETING END PIPELINE: Remaining participants will handle meeting end when they leave');
    }
    
    // Set flag immediately to prevent concurrent calls
    meetingEndTriggeredRef.current = true;
    
    // Get transcripts immediately before any disconnection
    const finalTranscripts = transcriptsRef.current;
    console.log('🔍 MEETING END PIPELINE: Final transcript count:', finalTranscripts.length);
    console.log('🔍 MEETING END PIPELINE: Final transcripts detail:', finalTranscripts.map(t => ({
      speaker: t.speaker,
      text: t.text.substring(0, 50) + '...',
      timestamp: new Date(t.timestamp).toLocaleString(),
      participantId: t.participantId
    })));
    
    // Get meeting ID for background processing from Zustand store (replaces localStorage)
    const meetingId = MeetingStorageUtils.getMeetingId(props.roomName);
    console.log('🆔 MEETING END PIPELINE: Meeting ID from storage:', meetingId);
    
    // Immediately disconnect and redirect - don't wait for transcript processing
    try {
      // Transcription service is handled by MeetingAssistant component
      console.log('🛑 Room is disconnecting...');
      
      if (room.state === 'connected') {
        console.log('🔌 Disconnecting from room immediately...');
        await room.disconnect();
      }
    } catch (error) {
      console.error('Error during immediate disconnect:', error);
    }

    // Check if user is a guest by checking if there's no meeting ID stored
    // Authenticated users creating meetings will have a meetingId stored in localStorage
    // Guests joining via direct room links won't have this
    const participantName = props.userChoices?.username || room?.localParticipant?.name || '';
    const participantIdentity = room?.localParticipant?.identity || '';
    
    // Guests are users who don't have a meetingId (they joined via direct link)
    // Or users whose username doesn't match a typical authenticated user pattern
    const isGuest = !meetingId || (participantName && !participantName.includes('@'));
    
    if (isGuest) {
      console.log('🚪 Guest user detected - redirecting to landing page...');
      router.push('/');
    } else {
      console.log('🏃 Authenticated user - redirecting to dashboard...');
      router.push(`/meetingroom/${props.roomName}`);
    }

    // Only process transcripts and end meeting if this is the last person leaving
    console.log('🔍 MEETING END PIPELINE: Checking conditions for meeting end processing:', {
      shouldEndMeeting,
      transcriptCount: finalTranscripts.length,
      hasMeetingId: !!meetingId
    });
    
    if (shouldEndMeeting && meetingId) {
      console.log('🔄 MEETING END PIPELINE: Starting background transcript processing for meeting end...');
      console.log('📊 MEETING END PIPELINE: Transcript count:', finalTranscripts.length);
      
      // Collect participant data before room disconnection
      const participantData = Array.from(room.remoteParticipants.values()).map(p => ({
        name: p.name || p.identity,
        isHost: false
      })).concat([{
        name: props.userChoices?.username || 'Host',
        isHost: true
      }]);
      
      console.log('👥 MEETING END PIPELINE: Collected participant data:', participantData);
      
      // Process meeting end in background without blocking the UI
      // Note: This will handle both empty and non-empty transcript cases
      processTranscriptsInBackground(finalTranscripts, meetingId, props.roomName, participantData)
        .then(() => {
          console.log('✅ MEETING END PIPELINE: Background transcript processing completed');
        })
        .catch((error) => {
          console.error('❌ MEETING END PIPELINE: Background transcript processing failed:', error);
        });
    } else {
      console.log('🔍 MEETING END PIPELINE: Skipping meeting end processing because:', {
        shouldEndMeeting: shouldEndMeeting ? '✅' : '❌ Not last participant',
        transcriptCount: finalTranscripts.length,
        hasMeetingId: meetingId ? '✅' : '❌ No meeting ID'
      });
      
      // If we have a meetingId but no transcripts and this is the last participant,
      // we should still call the end API to clean up the empty meeting
      if (shouldEndMeeting && meetingId && finalTranscripts.length === 0) {
        console.log('🗑️ MEETING END PIPELINE: Cleaning up empty meeting...');
        processTranscriptsInBackground([], meetingId, props.roomName, [])
          .then(() => {
            console.log('✅ MEETING END PIPELINE: Empty meeting cleanup completed');
          })
          .catch((error) => {
            console.error('❌ MEETING END PIPELINE: Empty meeting cleanup failed:', error);
          });
      }
    }
  }, [router, room, props.roomName, props.userChoices]);

  // Simplified background transcript processing function
  const processTranscriptsInBackground = async (
    transcripts: Transcript[], 
    meetingId: string, 
    roomName: string,
    participantData: Array<{name: string, isHost: boolean}>
  ) => {
    console.log('🔄 MEETING END API CALL: Processing transcripts in background...', { 
      meetingId, 
      transcriptCount: transcripts.length,
      roomName,
      participantCount: participantData.length
    });
    
    try {
      console.log('📝 MEETING END API CALL: Formatting transcripts...');
    const formattedTranscripts = transcripts.map(t => ({
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp
    }));

      console.log('👥 MEETING END API CALL: Formatting participants...');
      const participants = participantData.map(p => ({
        name: p.name,
        joinedAt: new Date().toISOString(),
        leftAt: new Date().toISOString(),
        isHost: p.isHost
      }));

      console.log('📡 MEETING END API CALL: Calling meeting end API...', {
        endpoint: `/api/meetings/${roomName}/end`,
        payload: {
          meetingId,
          transcriptCount: formattedTranscripts.length,
          participantCount: participants.length
        }
      });

      // Call the simplified meeting end API
    const response = await fetch(`/api/meetings/${roomName}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId,
        transcripts: formattedTranscripts,
          participants,
        endedAt: new Date().toISOString()
      }),
    });

      console.log('📡 MEETING END API CALL: API response received:', {
        status: response.status,
        ok: response.ok
      });

    if (response.ok) {
      const data = await response.json();
        console.log('✅ MEETING END API CALL: Meeting ended successfully, processing started:', data);
      
        // Clean up meeting ID from storage
      MeetingStorageUtils.removeMeetingId(roomName);
        console.log('🧹 MEETING END API CALL: Cleaned up meeting ID from storage');
        
        // Log processing results
        if (data.data?.processing) {
          const proc = data.data.processing;
          console.log('📋 MEETING END PIPELINE RESULTS:', {
            transcriptsStored: proc.transcriptsStored,
            summaryGenerated: proc.summaryGenerated,
            emailsSent: proc.emailsSent,
            tasksCreated: proc.tasksCreated,
            success: proc.success,
            error: proc.error
          });
        } else {
          console.log('⚠️ MEETING END API CALL: No processing results in response');
        }
      
      return data;
    } else {
        console.error('❌ MEETING END API CALL: API returned error status:', response.status);
      const errorData = await response.json();
        console.error('❌ MEETING END API CALL: Error details:', errorData);
      throw new Error(errorData.message || 'Failed to process meeting end');
      }
    } catch (error) {
      console.error('❌ MEETING END API CALL: Background processing failed:', error);
      // Clean up storage even if processing failed
      MeetingStorageUtils.removeMeetingId(roomName);
      throw error;
    }
  };

  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    
    // Don't show popup for screen sharing permission errors - these are normal when user cancels
    if (error.message.includes('Permission denied') || 
        error.message.includes('NotAllowedError') ||
        error.message.includes('screen') ||
        error.message.includes('getDisplayMedia')) {
      console.log('Screen sharing cancelled or permission denied - not showing error popup');
      return;
    }
    
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
        <div className="lk-video-conference" style={{ width: '100%', height: '100%' }}>
                  <CustomVideoConference
          SettingsComponent={SettingsMenu}
          onTranscriptsChange={setSharedTranscripts}
          onError={handleError}
          onLeave={handleOnLeave}
        />
        </div>
        
        {/* Share Link Modal */}
        {showShareModal && (
          <div className="share-modal-overlay" onClick={closeShareModal}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Share Meeting Link</h3>
              <p>Invite participants to join</p>
              
              <div className="share-link-container">
                <input
                  type="text"
                  value={meetingUrl}
                  readOnly
                  className="share-link-input"
                />
                <button onClick={copyToClipboard} className="share-copy-button">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p style={{ fontSize: '14px', color: '#94a3b8', margin: '16px 0 8px 0' }}>Quick Share:</p>
              <div className="share-quick-actions">
                <button onClick={shareViaEmail} className="share-action-button">
                  Email
                </button>
                <button onClick={shareViaWhatsApp} className="share-action-button">
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
        
        <KeyboardShortcuts />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}

// Custom VideoConference component with enhanced control bar
function CustomVideoConference({ 
  SettingsComponent, 
  onTranscriptsChange,
  onError,
  onLeave,
  ...props 
}: { 
  SettingsComponent?: React.ComponentType;
  onTranscriptsChange?: (transcripts: Transcript[]) => void;
  onError?: (error: Error) => void;
  onLeave?: () => void;
}) {
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
            <EnhancedControlBar 
              controls={{ 
                camera: true,
                microphone: true,
                screenShare: true,
                settings: !!SettingsComponent,
                leave: true
              }}
              onTranscriptsChange={onTranscriptsChange}
            />
          </div>
          {/* Settings Modal - Rendered when widget state shows settings */}
          {SettingsComponent && widgetState.showSettings && (
            <>
              <div 
                className="lk-modal-backdrop"
                onClick={() => layoutContext.widget.dispatch?.({ msg: 'toggle_settings' })}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 1001
                }}
              />
              <div className="lk-settings-menu-modal">
                <SettingsComponent />
              </div>
            </>
          )}
        </LayoutContextProvider>
      )}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
