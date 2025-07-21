'use client';

import React, { useState, useEffect } from 'react';
import { 
  useTracks, 
  useRoomContext, 
  useLocalParticipant, 
  useMediaDeviceSelect,
  TrackToggle,
  DisconnectButton,
  useLayoutContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ControlBarChat } from './control-bar-chat';
import { SimpleAIAssistant } from './simple-ai-assistant';
import { Transcript } from '@/lib/services/transcription';

interface EnhancedControlBarProps {
  onTranscriptsChange?: (transcripts: Transcript[]) => void;
  controls?: {
    camera?: boolean;
    microphone?: boolean;
    screenShare?: boolean;
    settings?: boolean;
    leave?: boolean;
  };
  SettingsComponent?: React.ComponentType;
  onSettingsToggle?: (show: boolean) => void;
}

export function EnhancedControlBar({ 
  onTranscriptsChange, 
  controls = {}, 
  SettingsComponent,
  onSettingsToggle
}: EnhancedControlBarProps) {
  const [showChat, setShowChat] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const layoutContext = useLayoutContext();
  
  // Track states - initialize based on actual participant state
  const [isCameraEnabled, setIsCameraEnabled] = useState(localParticipant?.isCameraEnabled ?? false);
  const [isMicEnabled, setIsMicEnabled] = useState(localParticipant?.isMicrophoneEnabled ?? false);
  const [isScreenSharing, setIsScreenSharing] = useState(localParticipant?.isScreenShareEnabled ?? false);

  // Apply layout adjustments to main video conference element
  useEffect(() => {
    const videoConference = document.querySelector('.lk-video-conference');
    
    if (videoConference) {
      if (showChat || showAI || showSettings) {
        videoConference.classList.add('panel-open');
      } else {
        videoConference.classList.remove('panel-open');
      }
    }
  }, [showChat, showAI, showSettings]);

  // Monitor track states and connection state
  useEffect(() => {
    if (!localParticipant || !room) return;

    const updateTrackStates = () => {
      // Try both the convenience methods and track-based approach
      const camEnabled = localParticipant.isCameraEnabled;
      const micEnabled = localParticipant.isMicrophoneEnabled;
      const screenEnabled = localParticipant.isScreenShareEnabled;
      
      // Alternative: Check tracks directly
      const cameraTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      const microphoneTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      const screenTrack = localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
      
      const camEnabledAlt = cameraTrack && !cameraTrack.isMuted;
      const micEnabledAlt = microphoneTrack && !microphoneTrack.isMuted;
      const screenEnabledAlt = screenTrack && !screenTrack.isMuted;
      
      console.log('🔄 Updating track states:', {
        camera: camEnabled,
        microphone: micEnabled,
        screenShare: screenEnabled,
        cameraAlt: camEnabledAlt,
        microphoneAlt: micEnabledAlt,
        screenAlt: screenEnabledAlt,
        roomState: room.state
      });
      
      // Use the alternative method if available
      setIsCameraEnabled(camEnabledAlt !== undefined ? camEnabledAlt : camEnabled);
      setIsMicEnabled(micEnabledAlt !== undefined ? micEnabledAlt : micEnabled);
      setIsScreenSharing(screenEnabledAlt !== undefined ? screenEnabledAlt : screenEnabled);
    };

    // Initial update
    updateTrackStates();
    
    // Update when room connects (important for initial state sync)
    const handleRoomConnected = () => {
      console.log('🔗 Room connected, syncing button states...');
      setTimeout(() => {
        updateTrackStates();
      }, 500); // Small delay to ensure tracks are fully established
    };
    
    room.on('connected', handleRoomConnected);
    
    // Polling for initial state sync - check multiple times in the first few seconds
    // This handles cases where tracks are already established when component mounts
    const pollInterval = setInterval(() => {
      updateTrackStates();
    }, 200);
    
    // Stop polling after 3 seconds
    const stopPolling = setTimeout(() => {
      clearInterval(pollInterval);
    }, 3000);
    
    // Listen to more events to catch state changes
    localParticipant.on('trackMuted', updateTrackStates);
    localParticipant.on('trackUnmuted', updateTrackStates);
    localParticipant.on('trackPublished', updateTrackStates);
    localParticipant.on('trackUnpublished', updateTrackStates);
    localParticipant.on('trackSubscribed', updateTrackStates);
    localParticipant.on('trackUnsubscribed', updateTrackStates);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(stopPolling);
      room.off('connected', handleRoomConnected);
      localParticipant.off('trackMuted', updateTrackStates);
      localParticipant.off('trackUnmuted', updateTrackStates);
      localParticipant.off('trackPublished', updateTrackStates);
      localParticipant.off('trackUnpublished', updateTrackStates);
      localParticipant.off('trackSubscribed', updateTrackStates);
      localParticipant.off('trackUnsubscribed', updateTrackStates);
    };
  }, [localParticipant, room]);

  const handleChatToggle = () => {
    setShowChat(!showChat);
    if (showAI) setShowAI(false);
    if (showSettings) setShowSettings(false);
  };

  const handleAIToggle = () => {
    setShowAI(!showAI);
    if (showChat) setShowChat(false);
    if (showSettings) setShowSettings(false);
  };

  const handleSettingsToggle = () => {
    const newShowSettings = !showSettings;
    setShowSettings(newShowSettings);
    if (showChat) setShowChat(false);
    if (showAI) setShowAI(false);
    
    // Call parent callback to update widget state
    onSettingsToggle?.(newShowSettings);
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    try {
      const currentState = isCameraEnabled;
      const newState = !currentState;
      console.log('📹 Toggling camera:', currentState, '->', newState);
      console.log('📹 LocalParticipant camera state before toggle:', localParticipant.isCameraEnabled);
      
      await localParticipant.setCameraEnabled(newState);
      
      // Force state update after toggle
      setTimeout(() => {
        const actualState = localParticipant.isCameraEnabled;
        console.log('📹 Camera state after toggle:', actualState);
        setIsCameraEnabled(actualState);
      }, 100);
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const toggleMicrophone = async () => {
    if (!localParticipant) return;
    try {
      const currentState = isMicEnabled;
      const newState = !currentState;
      console.log('🎤 Toggling microphone:', currentState, '->', newState);
      console.log('🎤 LocalParticipant microphone state before toggle:', localParticipant.isMicrophoneEnabled);
      
      await localParticipant.setMicrophoneEnabled(newState);
      
      // Force state update after toggle
      setTimeout(() => {
        const actualState = localParticipant.isMicrophoneEnabled;
        console.log('🎤 Microphone state after toggle:', actualState);
        setIsMicEnabled(actualState);
      }, 100);
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    try {
      const currentState = isScreenSharing;
      const newState = !currentState;
      console.log('🖥️ Toggling screen share:', currentState, '->', newState);
      console.log('🖥️ LocalParticipant screen share state before toggle:', localParticipant.isScreenShareEnabled);
      
      await localParticipant.setScreenShareEnabled(newState);
      
      // Force state update after toggle
      setTimeout(() => {
        const actualState = localParticipant.isScreenShareEnabled;
        console.log('🖥️ Screen share state after toggle:', actualState);
        setIsScreenSharing(actualState);
      }, 100);
    } catch (error) {
      console.log('Screen sharing error caught:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          // User cancelled or denied permission - don't show error
          console.log('Screen sharing cancelled by user');
          return; // Don't show any error to user
        } else if (error.name === 'NotSupportedError') {
          alert('Screen sharing is not supported in this browser.');
        } else {
          alert('Failed to start screen sharing. Please try again.');
        }
      } else if (typeof error === 'string' && error.includes('Permission denied')) {
        // Handle string error messages about permission
        console.log('Screen sharing permission denied by user');
        return; // Don't show any error to user
      } else {
        alert('Failed to start screen sharing. Please try again.');
      }
    }
  };

  const handleLeave = () => {
    room?.disconnect();
    window.location.href = '/';
  };

  // Debug: Log button states
  console.log('🎛️ Control bar render - Button states:', {
    camera: isCameraEnabled,
    microphone: isMicEnabled,
    screenShare: isScreenSharing
  });

  return (
    <>
      {/* Custom Control Bar */}
      <div className="custom-control-bar">
        {/* Camera Button */}
        {(controls.camera ?? true) && (
          <button
            className={`control-bar-button ${isCameraEnabled ? 'active' : ''}`}
            onClick={toggleCamera}
            title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            style={{ 
              // Debug: Force blue background when active for testing
              ...(isCameraEnabled && {
                background: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 0.6)',
                color: 'white'
              })
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {isCameraEnabled ? (
                <path d="M23 7l-7 5 7 5V7z M16 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <>
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
            <span>Camera</span>
          </button>
        )}

        {/* Microphone Button */}
        {(controls.microphone ?? true) && (
          <button
            className={`control-bar-button ${isMicEnabled ? 'active' : ''}`}
            onClick={toggleMicrophone}
            title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
            style={{ 
              // Debug: Force blue background when active for testing
              ...(isMicEnabled && {
                background: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 0.6)',
                color: 'white'
              })
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {isMicEnabled ? (
                <>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </>
              ) : (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
            <span>Microphone</span>
          </button>
        )}

        {/* Screen Share Button */}
        {(controls.screenShare ?? true) && (
          <button
            className={`control-bar-button ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            style={{ 
              // Debug: Force blue background when active for testing
              ...(isScreenSharing && {
                background: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 0.6)',
                color: 'white'
              })
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2"/>
              <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
              {isScreenSharing && (
                <path d="M8 10l4-4 4 4M12 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
            <span>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</span>
          </button>
        )}

                 {/* Settings Button */}
         {(controls.settings ?? true) && (
           <button
             className={`control-bar-button ${showSettings ? 'active' : ''}`}
             onClick={handleSettingsToggle}
             title="Settings"
           >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>Settings</span>
          </button>
        )}

        {/* Chat Button */}
        <button
          className={`control-bar-button ${showChat ? 'active' : ''}`}
          onClick={handleChatToggle}
          title="Toggle Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>Chat</span>
        </button>

        {/* AI Assistant Button */}
        <button
          className={`control-bar-button ${showAI ? 'active' : ''}`}
          onClick={handleAIToggle}
          title="Toggle AI Assistant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>AI Assistant</span>
        </button>

        {/* Leave Button */}
        {(controls.leave ?? true) && (
          <button
            className="control-bar-button leave-button"
            onClick={handleLeave}
            title="Leave Meeting"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Leave</span>
          </button>
        )}
      </div>

      {/* Chat Panel */}
      <div className={`right-side-panel ${showChat ? 'open' : ''}`}>
      <ControlBarChat 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
      />
      </div>

      {/* Settings Panel */}
      <div className={`right-side-panel ${showSettings ? 'open' : ''}`}>
        {showSettings && (
          <div className="settings-panel">
            <div className="panel-header">
              <div className="panel-header-content">
                <div className="panel-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <h3 className="panel-title">Settings</h3>
              </div>
              <button className="close-button" onClick={() => setShowSettings(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="panel-content">
              <div className="settings-section">
                <h4 className="settings-section-title">Audio & Video</h4>
                <div className="settings-item">
                  <label>Camera</label>
                  <select className="settings-select">
                    <option>Default Camera</option>
                  </select>
                </div>
                <div className="settings-item">
                  <label>Microphone</label>
                  <select className="settings-select">
                    <option>Default Microphone</option>
                  </select>
                </div>
                <div className="settings-item">
                  <label>Speaker</label>
                  <select className="settings-select">
                    <option>Default Speaker</option>
                  </select>
                </div>
              </div>
              <div className="settings-section">
                <h4 className="settings-section-title">Meeting</h4>
                <div className="settings-item">
                  <label>Room Name</label>
                  <input type="text" className="settings-input" value={room?.name || ''} readOnly />
                </div>
                <div className="settings-item">
                  <label>Participants</label>
                  <input type="text" className="settings-input" value={`${room?.numParticipants || 0} connected`} readOnly />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Panel */}
      <div className={`right-side-panel ${showAI ? 'open' : ''}`}>
      <SimpleAIAssistant 
        isOpen={showAI} 
        onClose={() => setShowAI(false)}
        onTranscriptsChange={onTranscriptsChange}
      />
      </div>
    </>
  );
} 