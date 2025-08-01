'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  useTracks, 
  useRoomContext, 
  useLocalParticipant, 
  useMediaDeviceSelect,
  TrackToggle,
  DisconnectButton,
  useLayoutContext,
  useParticipants
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  Settings, 
  Users, 
  MessageSquare, 
  Bot, 
  PhoneOff,
  X,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ControlBarChat } from './control-bar-chat';
import { SimpleAIAssistant } from './simple-ai-assistant';
import { TranscriptsPanel } from './transcripts-panel';
import { SettingsMenu } from './settings-menu';
import { PermissionModal } from './permission-modal';
import { isPermissionError, parsePermissionError, type PermissionError } from '@/lib/utils/permission-utils';
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
}

export function EnhancedControlBar({ 
  onTranscriptsChange, 
  controls = {}
}: EnhancedControlBarProps) {
  const [showChat, setShowChat] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [currentTranscripts, setCurrentTranscripts] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    // Load saved width from localStorage or use percentage-based default
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ohm-panel-width');
      if (saved) {
        return parseInt(saved, 10);
      }
      // Default to 35% of window width, with min/max constraints
      const defaultWidth = Math.max(350, Math.min(600, window.innerWidth * 0.35));
      return Math.round(defaultWidth);
    }
    return 450; // Fallback for SSR
  });
  const [isResizing, setIsResizing] = useState(false);
  
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const layoutContext = useLayoutContext();
  const participants = useParticipants();

  // Handle mobile detection and window resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isMobileView = window.innerWidth < 768;
        setIsMobile(isMobileView);
        
        // Close mobile menu on desktop
        if (!isMobileView) {
          setShowMobileMenu(false);
        }
        
        // Handle panel width for desktop
        if (!isMobileView) {
          const maxAllowed = Math.min(800, window.innerWidth * 0.7);
          const minAllowed = Math.max(300, window.innerWidth * 0.2);
          
          const savedWidth = localStorage.getItem('ohm-panel-width');
          if (savedWidth) {
            const currentWidth = parseInt(savedWidth, 10);
            if (currentWidth > maxAllowed || currentWidth < minAllowed) {
              const adjustedWidth = Math.max(minAllowed, Math.min(maxAllowed, currentWidth));
              setPanelWidth(adjustedWidth);
              localStorage.setItem('ohm-panel-width', adjustedWidth.toString());
            }
          }
        }
      }
    };

    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Track states - initialize based on actual participant state
  const [isCameraEnabled, setIsCameraEnabled] = useState(localParticipant?.isCameraEnabled ?? false);
  const [isMicEnabled, setIsMicEnabled] = useState(localParticipant?.isMicrophoneEnabled ?? false);
  const [isScreenSharing, setIsScreenSharing] = useState(localParticipant?.isScreenShareEnabled ?? false);
  
  // Permission modal state
  const [permissionModal, setPermissionModal] = useState<{
    isOpen: boolean;
    type: 'camera' | 'microphone' | 'screen' | 'audio';
    error?: string;
  }>({
    isOpen: false,
    type: 'camera'
  });

  // Apply layout adjustments to main video conference element
  useEffect(() => {
    const videoConference = document.querySelector('.lk-video-conference');
    
    if (videoConference) {
      if (showChat || showAI || showParticipants || showTranscripts) {
        videoConference.classList.add('panel-open');
        (videoConference as HTMLElement).style.setProperty('--panel-width', `${panelWidth}px`);
      } else {
        videoConference.classList.remove('panel-open');
        (videoConference as HTMLElement).style.removeProperty('--panel-width');
      }
    }
  }, [showChat, showAI, showParticipants, showTranscripts, panelWidth]);

  // Handle double-click to reset width
  const handleDoubleClick = () => {
    const defaultWidth = Math.max(350, Math.min(600, window.innerWidth * 0.35));
    const resetWidth = Math.round(defaultWidth);
    setPanelWidth(resetWidth);
    localStorage.setItem('ohm-panel-width', resetWidth.toString());
  };

  // Handle panel resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    // Add resizing class to body for visual feedback
    document.body.classList.add('resizing');
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX; // Reversed because we're dragging from left edge
      
      // Dynamic constraints based on window size
      const minWidth = Math.max(300, window.innerWidth * 0.2); // Min 20% of window
      const maxWidth = Math.min(800, window.innerWidth * 0.7); // Max 70% of window
      
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
      setPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save width to localStorage
      localStorage.setItem('ohm-panel-width', panelWidth.toString());
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

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
    if (showParticipants) setShowParticipants(false);
    if (showTranscripts) setShowTranscripts(false);
    
    // Clear unread messages when opening chat
    if (!showChat) {
      setHasUnreadMessages(false);
    }
  };

  const handleAIToggle = () => {
    setShowAI(!showAI);
    if (showChat) setShowChat(false);
    if (showParticipants) setShowParticipants(false);
    if (showTranscripts) setShowTranscripts(false);
  };

  const handleParticipantsToggle = () => {
    setShowParticipants(!showParticipants);
    if (showChat) setShowChat(false);
    if (showAI) setShowAI(false);
    if (showTranscripts) setShowTranscripts(false);
  };

  const handleTranscriptsToggle = () => {
    setShowTranscripts(!showTranscripts);
    if (showChat) setShowChat(false);
    if (showAI) setShowAI(false);
    if (showParticipants) setShowParticipants(false);
  };

  const handleSettingsToggle = () => {
    if (showChat) setShowChat(false);
    if (showAI) setShowAI(false);
    if (showParticipants) setShowParticipants(false);
    if (showTranscripts) setShowTranscripts(false);
    
    setShowSettings(!showSettings);
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
      
      // Check if this is a permission error
      if (isPermissionError(error)) {
        const permissionError = parsePermissionError(error, 'camera');
        setPermissionModal({
          isOpen: true,
          type: 'camera',
          error: permissionError.message
        });
      } else {
        // For non-permission errors, show a generic alert
        if (error instanceof Error && error.name === 'NotSupportedError') {
          alert('Camera is not supported in this browser.');
        } else {
          alert('Failed to access camera. Please check your camera settings and try again.');
        }
      }
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
      
      // Check if this is a permission error
      if (isPermissionError(error)) {
        const permissionError = parsePermissionError(error, 'microphone');
        setPermissionModal({
          isOpen: true,
          type: 'microphone',
          error: permissionError.message
        });
      } else {
        // For non-permission errors, show a generic alert
        if (error instanceof Error && error.name === 'NotSupportedError') {
          alert('Microphone is not supported in this browser.');
        } else {
          alert('Failed to access microphone. Please check your microphone settings and try again.');
        }
      }
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
      // Check if this is a permission error
      if (isPermissionError(error)) {
        const permissionError = parsePermissionError(error, 'screen');
        setPermissionModal({
          isOpen: true,
          type: 'screen',
          error: permissionError.message
        });
      } else if (error instanceof Error) {
        if (error.name === 'NotSupportedError') {
          alert('Screen sharing is not supported in this browser.');
        } else {
          alert('Failed to start screen sharing. Please try again.');
        }
      } else {
        alert('Failed to start screen sharing. Please try again.');
      }
    }
  };

  const handleLeave = () => {
    console.log('🚪 CONTROL BAR: Leave button clicked - disconnecting room...');
    room?.disconnect();
    // Don't redirect immediately - let the RoomEvent.Disconnected handler take care of it
  };

  // Mobile-specific handlers
  const handleMobileMenuToggle = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const handleMobilePanelOpen = (panelType: 'chat' | 'ai' | 'participants' | 'transcripts' | 'settings') => {
    // Close mobile menu first
    setShowMobileMenu(false);
    
    // Close all panels first
    setShowChat(false);
    setShowAI(false);
    setShowParticipants(false);
    setShowTranscripts(false);
    setShowSettings(false);
    
    // Open the selected panel
    switch (panelType) {
      case 'chat':
        setShowChat(true);
        break;
      case 'ai':
        setShowAI(true);
        break;
      case 'participants':
        setShowParticipants(true);
        break;
      case 'transcripts':
        setShowTranscripts(true);
        break;
      case 'settings':
        setShowSettings(true);
        break;
    }
  };

  // Debug: Log button states
  console.log('🎛️ Control bar render - Button states:', {
    camera: isCameraEnabled,
    microphone: isMicEnabled,
    screenShare: isScreenSharing
  });

  return (
    <>
      {/* Mobile Control Bar */}
      {isMobile ? (
        /* Simplified Mobile Control Bar - Only Essential Controls */
        <div className="custom-control-bar mobile-control-bar">
          {/* Camera Button */}
          {(controls.camera ?? true) && (
            <Button
              size="icon"
              onClick={toggleCamera}
              title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              className={cn(
                "min-h-touch min-w-touch rounded-full transition-all duration-200",
                isCameraEnabled 
                  ? "bg-blue-600 active:bg-blue-700 text-white" 
                  : "bg-transparent active:bg-white/10 text-red-500"
              )}
            >
              {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </Button>
          )}

          {/* Microphone Button */}
          {(controls.microphone ?? true) && (
            <Button
              size="icon"
              onClick={toggleMicrophone}
              title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              className={cn(
                "min-h-touch min-w-touch rounded-full transition-all duration-200",
                isMicEnabled 
                  ? "bg-blue-600 active:bg-blue-700 text-white" 
                  : "bg-transparent active:bg-white/10 text-red-500"
              )}
            >
              {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </Button>
          )}

          {/* Settings Button */}
          {(controls.settings ?? true) && (
            <Button
              size="icon"
              onClick={handleSettingsToggle}
              title="Settings"
              className={cn(
                "min-h-touch min-w-touch rounded-full transition-all duration-200",
                showSettings 
                  ? "bg-blue-600 active:bg-blue-700 text-white" 
                  : "bg-transparent active:bg-white/10 text-white"
              )}
            >
              <Settings size={24} />
            </Button>
          )}

          {/* Leave Button */}
          {(controls.leave ?? true) && (
            <Button
              variant="destructive"
              size="icon"
              onClick={handleLeave}
              title="Leave Meeting"
              className="min-h-touch min-w-touch rounded-full"
            >
              <PhoneOff size={24} />
            </Button>
          )}
        </div>
      ) : (
        /* Desktop Control Bar - Original layout */
        <div className="custom-control-bar">
          {/* Camera Button */}
          {(controls.camera ?? true) && (
            <Button
              size="icon"
              onClick={toggleCamera}
              title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              className={cn(
                "h-12 w-12 rounded-full transition-all duration-200",
                isCameraEnabled 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-transparent hover:bg-white/10 text-red-500"
              )}
            >
              {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </Button>
          )}

          {/* Microphone Button */}
          {(controls.microphone ?? true) && (
            <Button
              size="icon"
              onClick={toggleMicrophone}
              title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              className={cn(
                "h-12 w-12 rounded-full transition-all duration-200",
                isMicEnabled 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-transparent hover:bg-white/10 text-red-500"
              )}
            >
              {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </Button>
          )}

          {/* Screen Share Button */}
          {(controls.screenShare ?? true) && (
            <Button
              size="icon"
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              className={cn(
                "h-12 w-12 rounded-full transition-all duration-200",
                isScreenSharing 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-transparent hover:bg-white/10 text-white"
              )}
            >
              <Monitor size={20} />
            </Button>
          )}

          {/* Divider */}
          <div className="w-px h-8 bg-gray-600 mx-1" />

          {/* Settings Button */}
          {(controls.settings ?? true) && (
            <Button
              size="icon"
              onClick={handleSettingsToggle}
              title="Settings"
              className={cn(
                "h-12 w-12 rounded-full transition-all duration-200",
                showSettings 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-transparent hover:bg-white/10 text-white"
              )}
            >
              <Settings size={20} />
            </Button>
          )}

          {/* Participants Button */}
          <Button
            size="icon"
            onClick={handleParticipantsToggle}
            title="Participants"
            className={cn(
              "h-12 w-12 rounded-full relative transition-all duration-200",
              showParticipants 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-transparent hover:bg-white/10 text-white"
            )}
          >
            <Users size={20} />
          </Button>

          {/* Chat Button */}
          <Button
            size="icon"
            onClick={handleChatToggle}
            title="Chat"
            className={cn(
              "h-12 w-12 rounded-full relative transition-all duration-200",
              showChat 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-transparent hover:bg-white/10 text-white"
            )}
          >
            <MessageSquare size={20} />
            {hasUnreadMessages && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
            )}
          </Button>

          {/* AI Assistant Button */}
          <Button
            size="icon"
            onClick={handleAIToggle}
            title="AI Assistant"
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-200",
              showAI 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-transparent hover:bg-white/10 text-white"
            )}
          >
            <Bot size={20} />
          </Button>

          {/* Transcripts Button */}
          <Button
            size="icon"
            onClick={handleTranscriptsToggle}
            title="Transcripts"
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-200",
              showTranscripts 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-transparent hover:bg-white/10 text-white"
            )}
          >
            <FileText size={20} />
          </Button>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-600 mx-1" />

          {/* Leave Button */}
          {(controls.leave ?? true) && (
            <Button
              variant="destructive"
              size="icon"
              onClick={handleLeave}
              title="Leave Meeting"
              className="h-12 w-12 rounded-full"
            >
              <PhoneOff size={20} />
            </Button>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div 
        className={cn(
          "fixed top-0 h-full border-l border-gray-700 shadow-lg transition-all duration-300 z-40",
          isMobile 
            ? "left-0 w-full bg-black/95 backdrop-blur-sm" 
            : "right-0",
          showChat ? "translate-x-0" : "translate-x-full"
        )}
        style={{ 
          width: !isMobile && showChat ? `${panelWidth}px` : isMobile ? '100%' : '0'
        }}
      >
        {showChat && (
          <>
            {/* Mobile Close Button */}
            {isMobile && (
              <Button
                size="icon"
                onClick={() => setShowChat(false)}
                className="absolute top-4 right-4 z-50 min-h-touch min-w-touch bg-white/10 hover:bg-white/20 text-white rounded-full"
              >
                <X size={20} />
              </Button>
            )}
            
            {/* Desktop Resize Handle */}
            {!isMobile && (
              <div 
                className="absolute left-0 top-0 w-1 h-full bg-slate-700 hover:bg-gray-600 cursor-col-resize transition-colors"
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title="Drag to resize panel (double-click to reset)"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
                </div>
              </div>
            )}
          </>
        )}
        <ControlBarChat 
          isOpen={showChat} 
          onClose={() => setShowChat(false)}
          onNewMessage={() => {
            if (!showChat) {
              setHasUnreadMessages(true);
            }
          }}
        />
      </div>

      {/* AI Assistant Panel */}
      <div 
        className={cn(
          "fixed top-0 h-full border-l border-gray-700 shadow-lg transition-all duration-300 z-40",
          isMobile 
            ? "left-0 w-full bg-black/95 backdrop-blur-sm" 
            : "right-0",
          showAI ? "translate-x-0" : "translate-x-full"
        )}
        style={{ 
          width: !isMobile && showAI ? `${panelWidth}px` : isMobile ? '100%' : '0'
        }}
      >
        {showAI && (
          <>
            {/* Mobile Close Button */}
            {isMobile && (
              <Button
                size="icon"
                onClick={() => setShowAI(false)}
                className="absolute top-4 right-4 z-50 min-h-touch min-w-touch bg-white/10 hover:bg-white/20 text-white rounded-full"
              >
                <X size={20} />
              </Button>
            )}
            
            {/* Desktop Resize Handle */}
            {!isMobile && (
              <div 
                className="absolute left-0 top-0 w-1 h-full bg-slate-700 hover:bg-gray-600 cursor-col-resize transition-colors"
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title="Drag to resize panel (double-click to reset)"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
                </div>
              </div>
            )}
          </>
        )}
        <SimpleAIAssistant 
          isOpen={showAI} 
          onClose={() => setShowAI(false)}
          currentTranscripts={currentTranscripts}
        />
      </div>

      {/* Transcripts Panel */}
      <div 
        className={cn(
          "fixed top-0 h-full border-l border-gray-700 shadow-lg transition-all duration-300 z-40",
          isMobile 
            ? "left-0 w-full bg-black/95 backdrop-blur-sm" 
            : "right-0",
          showTranscripts ? "translate-x-0" : "translate-x-full"
        )}
        style={{ 
          width: !isMobile && showTranscripts ? `${panelWidth}px` : isMobile ? '100%' : '0'
        }}
      >
        {showTranscripts && (
          <>
            {/* Mobile Close Button */}
            {isMobile && (
              <Button
                size="icon"
                onClick={() => setShowTranscripts(false)}
                className="absolute top-4 right-4 z-50 min-h-touch min-w-touch bg-white/10 hover:bg-white/20 text-white rounded-full"
              >
                <X size={20} />
              </Button>
            )}
            
            {/* Desktop Resize Handle */}
            {!isMobile && (
              <div 
                className="absolute left-0 top-0 w-1 h-full bg-slate-700 hover:bg-gray-600 cursor-col-resize transition-colors"
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title="Drag to resize panel (double-click to reset)"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
                </div>
              </div>
            )}
          </>
        )}
        <TranscriptsPanel 
          isOpen={showTranscripts} 
          onClose={() => setShowTranscripts(false)}
          onTranscriptsChange={useCallback((transcripts: Transcript[]) => {
            if (onTranscriptsChange) {
              onTranscriptsChange(transcripts);
            }
            // Format transcripts for AI assistant
            const formattedTranscripts = transcripts
              .map((t: Transcript) => `${t.speaker}: ${t.text}`)
              .join('\n');
            setCurrentTranscripts(formattedTranscripts);
          }, [onTranscriptsChange])}
        />
      </div>

      {/* Participants Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full bg-[#1a1a1a] border-l border-[rgba(55,65,81,0.3)] shadow-lg transition-all duration-300 z-40",
          showParticipants ? "translate-x-0" : "translate-x-full"
        )}
        style={{ 
          width: showParticipants ? `${panelWidth}px` : '0'
        }}
      >
        {showParticipants && (
          <div 
            className="absolute left-0 top-0 w-1 h-full bg-slate-700 hover:bg-gray-600 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title="Drag to resize panel (double-click to reset)"
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(55,65,81,0.3)]">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gray-400" />
            <h3 className="font-medium text-white">Participants ({participants.length})</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowParticipants(false)}
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {participants.length > 0 ? (
            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div key={participant.identity} className="flex items-center gap-3 p-3 hover:bg-[#2a2a2a] transition-colors">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-medium",
                    participant.isLocal ? "bg-blue-600" : "bg-[#374151]"
                  )}>
                    {(participant.name || participant.identity || 'U').charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {participant.name || participant.identity}
                      {participant.isLocal && ' (You)'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {participant.isLocal ? 'Local' : 'Remote'}
                      {participant.isCameraEnabled && ' • Camera'}
                      {participant.isMicrophoneEnabled && ' • Mic'}
                    </div>
                  </div>
                  
                  {/* Mic/Camera indicators */}
                  <div className="flex gap-1">
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center",
                      participant.isMicrophoneEnabled ? "bg-green-500" : "bg-destructive"
                    )}>
                      {participant.isMicrophoneEnabled ? (
                        <Mic size={10} className="text-white" />
                      ) : (
                        <MicOff size={10} className="text-white" />
                      )}
                    </div>
                    
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center",
                      participant.isCameraEnabled ? "bg-green-500" : "bg-destructive"
                    )}>
                      {participant.isCameraEnabled ? (
                        <Video size={10} className="text-white" />
                      ) : (
                        <VideoOff size={10} className="text-white" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 p-5 text-sm">
              No participants connected
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3000]"
            onClick={() => setShowSettings(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[3100] p-4">
            <SettingsMenu onClose={() => setShowSettings(false)} />
          </div>
        </>
      )}

      {/* Permission Modal */}
      <PermissionModal
        isOpen={permissionModal.isOpen}
        onClose={() => setPermissionModal({ ...permissionModal, isOpen: false })}
        permissionType={permissionModal.type}
        error={permissionModal.error}
      />
    </>
  );
} 