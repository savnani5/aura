'use client';

import * as React from 'react';
import { Track, LocalVideoTrack } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  useRoomContext,
  useLocalParticipant,
  TrackReference,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication } from 'livekit-client';
import { 
  Settings, 
  X, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Volume2,
  Camera,
  FlipHorizontal,
  Sparkles,
  TestTube,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PermissionModal } from './permission-modal';
import { isPermissionError, parsePermissionError } from '@/lib/utils/permission-utils';

export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function SettingsMenu(props: SettingsMenuProps) {
  const { onClose, ...otherProps } = props;
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const { localParticipant, cameraTrack } = useLocalParticipant();

  // Independent preview states (don't affect live meeting)
  const [previewCameraEnabled, setPreviewCameraEnabled] = React.useState(false);
  const [previewMicEnabled, setPreviewMicEnabled] = React.useState(false);
  const [previewIsMirrored, setPreviewIsMirrored] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camera-mirrored');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  // Background type state
  type BackgroundType = 'none' | 'blur';
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>(() => {
    // Check the current camera track processor state first
    if (typeof window !== 'undefined' && cameraTrack?.track) {
      const processor = (cameraTrack.track as any).getProcessor?.();
      if (processor?.name === 'background-blur') {
        return 'blur';
      }
    }
    
    // Fallback to localStorage, but default to 'none'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camera-blur');
      return saved && JSON.parse(saved) ? 'blur' : 'none';
    }
    return 'none';
  });
  
  const [isTrackTransitioning, setIsTrackTransitioning] = React.useState(false);
  
  // Permission modal state
  const [permissionModal, setPermissionModal] = React.useState<{
    isOpen: boolean;
    type: 'camera' | 'microphone' | 'screen' | 'audio';
    error?: string;
  }>({
    isOpen: false,
    type: 'camera'
  });
  
  // For backwards compatibility
  const previewBlurEnabled = backgroundType === 'blur';
  const setPreviewBlurEnabled = (enabled: boolean) => {
    setBackgroundType(enabled ? 'blur' : 'none');
  };
  
  // Device selection states
  const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<{id: string, label: string}>({id: '', label: 'Default Camera'});
  const [selectedAudioDevice, setSelectedAudioDevice] = React.useState<{id: string, label: string}>({id: '', label: 'Default Microphone'});
  const [selectedAudioOutput, setSelectedAudioOutput] = React.useState<{id: string, label: string}>({id: '', label: 'Default Speaker'});
  const [showVideoDropdown, setShowVideoDropdown] = React.useState(false);
  const [showAudioDropdown, setShowAudioDropdown] = React.useState(false);
  const [showOutputDropdown, setShowOutputDropdown] = React.useState(false);
  const [availableDevices, setAvailableDevices] = React.useState<{
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
    output: MediaDeviceInfo[];
  }>({ video: [], audio: [], output: [] });
  
  // Independent streams for testing
  const [previewAudioStream, setPreviewAudioStream] = React.useState<MediaStream | null>(null);
  const [audioLevels, setAudioLevels] = React.useState<number[]>(new Array(20).fill(0));

  const animationIdRef = React.useRef<number>();

  // Create camera track reference for LiveKit VideoTrack component
  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Load available devices
  React.useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        
        setAvailableDevices({
          video: videoDevices,
          audio: audioDevices,
          output: audioOutputs
        });
        
        // Set defaults
        if (videoDevices.length > 0) {
          setSelectedVideoDevice({
            id: videoDevices[0].deviceId,
            label: videoDevices[0].label || 'Default Camera'
          });
        }
        if (audioDevices.length > 0) {
          setSelectedAudioDevice({
            id: audioDevices[0].deviceId,
            label: audioDevices[0].label || 'Default Microphone'
          });
        }
        if (audioOutputs.length > 0) {
          setSelectedAudioOutput({
            id: audioOutputs[0].deviceId,
            label: audioOutputs[0].label || 'Default Speaker'
          });
        }
      } catch (error) {
        console.error('Error loading devices:', error);
      }
    };
    
    loadDevices();
  }, []);

  // Initialize preview states when modal opens
  React.useEffect(() => {
    if (localParticipant) {
      setPreviewCameraEnabled(localParticipant.isCameraEnabled);
      setPreviewMicEnabled(localParticipant.isMicrophoneEnabled);
      
      // Sync background type with current track processor
      if (cameraTrack?.track && isLocalTrack(cameraTrack.track)) {
        const processor = (cameraTrack.track as any).getProcessor?.();
        if (processor?.name === 'background-blur') {
          setBackgroundType('blur');
        } else {
          setBackgroundType('none');
        }
      }
      
      // Initialize mirror CSS variable
      document.documentElement.style.setProperty(
        '--local-camera-transform', 
        previewIsMirrored ? 'scaleX(-1)' : 'scaleX(1)'
      );
    }
  }, [localParticipant, cameraTrack, previewIsMirrored]);

  

  // Handle camera preview toggle - apply immediately for preview
  React.useEffect(() => {
    const toggleCameraForPreview = async () => {
      if (localParticipant && previewCameraEnabled !== localParticipant.isCameraEnabled) {
        try {
          setIsTrackTransitioning(true);
          await localParticipant.setCameraEnabled(previewCameraEnabled);
          console.log('Camera preview toggled:', previewCameraEnabled);
          // Wait for track to stabilize
          setTimeout(() => {
            setIsTrackTransitioning(false);
          }, 300);
        } catch (error) {
          console.error('Error toggling camera for preview:', error);
          setIsTrackTransitioning(false);
          // Revert the preview state if the toggle failed
          setPreviewCameraEnabled(localParticipant.isCameraEnabled);
          
          // Check if this is a permission error
          if (isPermissionError(error)) {
            const permissionError = parsePermissionError(error, 'camera');
            setPermissionModal({
              isOpen: true,
              type: 'camera',
              error: permissionError.message
            });
          }
        }
      }
    };

    toggleCameraForPreview();
  }, [previewCameraEnabled, localParticipant]);

  // Apply background blur to the actual camera track (for live meeting) with debouncing
  React.useEffect(() => {
    let isMounted = true;
    
    const applyProcessor = async () => {
      // Wait a bit for track to stabilize after transitions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isMounted) return;
      
      if (!isTrackTransitioning &&
          isLocalTrack(cameraTrack?.track) && 
          cameraTrack.track.mediaStreamTrack.readyState === 'live' &&
          !cameraTrack.track.mediaStreamTrack.muted) {
        try {
          if (backgroundType === 'blur') {
            console.log('🌫️ Applying background blur to live track');
            await cameraTrack.track?.setProcessor(BackgroundBlur());
          } else {
            console.log('🚫 Stopping background processor');
            await cameraTrack.track?.stopProcessor();
          }
        } catch (error) {
          console.error('Error applying background processor:', error);
          // If error, try again after a longer delay
          setTimeout(() => {
            if (!isMounted) return;
            
            if (!isTrackTransitioning &&
                isLocalTrack(cameraTrack?.track) && 
                cameraTrack.track.mediaStreamTrack.readyState === 'live' &&
                !cameraTrack.track.mediaStreamTrack.muted) {
              try {
                if (backgroundType === 'blur') {
                  cameraTrack.track?.setProcessor(BackgroundBlur());
                } else {
                  cameraTrack.track?.stopProcessor();
                }
              } catch (retryError) {
                console.error('Retry failed for background processor:', retryError);
              }
            }
          }, 500);
        }
      }
    };

    applyProcessor();
    
    return () => {
      isMounted = false;
    };
  }, [cameraTrack, backgroundType, isTrackTransitioning]);

  // Apply mirror setting immediately when toggled
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      '--local-camera-transform', 
      previewIsMirrored ? 'scaleX(-1)' : 'scaleX(1)'
    );
    
    // Also apply to any existing video elements
    const videoElements = document.querySelectorAll('.lk-participant-tile video, .lk-focus-layout video');
    videoElements.forEach((video) => {
      const participant = (video as any).closest('[data-lk-local-participant]');
      if (participant) {
        (video as HTMLVideoElement).style.transform = previewIsMirrored ? 'scaleX(-1)' : 'scaleX(1)';
      }
    });
  }, [previewIsMirrored]);

  // Handle independent microphone preview with audio levels
  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const setupMicrophonePreview = async () => {
      if (previewMicEnabled) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: selectedAudioDevice.id || undefined },
            video: false 
          });
          setPreviewAudioStream(stream);

          // Setup audio level visualization
          audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const updateLevels = () => {
            analyser.getByteTimeDomainData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const sample = (dataArray[i] - 128) / 128;
              sum += sample * sample;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            
            const newLevels = [];
            for (let i = 0; i < 20; i++) {
              const baseLevel = rms * 3;
              const variation = (Math.random() - 0.5) * 0.1;
              const level = Math.max(0, Math.min(1, baseLevel + variation));
              newLevels.push(level);
            }
            
            setAudioLevels(newLevels);
          };
          
          intervalId = setInterval(updateLevels, 50);
          
        } catch (error) {
          console.error('Error accessing microphone for preview:', error);
          setPreviewMicEnabled(false);
          
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
      } else {
        setAudioLevels(new Array(20).fill(0));
        if (previewAudioStream) {
          previewAudioStream.getTracks().forEach(track => track.stop());
          setPreviewAudioStream(null);
        }
      }
    };

    setupMicrophonePreview();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [previewMicEnabled, selectedAudioDevice.id]);

  // Apply settings to live meeting
  const applySettings = React.useCallback(async () => {
    if (!localParticipant) return;
    
    try {
      // Apply camera state
      if (previewCameraEnabled !== localParticipant.isCameraEnabled) {
        setIsTrackTransitioning(true);
        await localParticipant.setCameraEnabled(previewCameraEnabled);
        // Wait a bit for track to stabilize before processors are applied
        await new Promise(resolve => setTimeout(resolve, 200));
        setIsTrackTransitioning(false);
      }

      // Apply microphone state
      if (previewMicEnabled !== localParticipant.isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(previewMicEnabled);
      }

      // Apply mirror setting
      localStorage.setItem('camera-mirrored', JSON.stringify(previewIsMirrored));
      document.documentElement.style.setProperty(
        '--local-camera-transform', 
        previewIsMirrored ? 'scaleX(-1)' : 'scaleX(1)'
      );
      
      // Also apply to any existing video elements with the mirror class
      const videoElements = document.querySelectorAll('.lk-participant-tile video, .lk-focus-layout video');
      videoElements.forEach((video) => {
        const participant = (video as any).closest('[data-lk-local-participant]');
        if (participant) {
          (video as HTMLVideoElement).style.transform = previewIsMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        }
      });

      // Apply blur setting
      localStorage.setItem('camera-blur', JSON.stringify(backgroundType === 'blur'));
      
      console.log('Settings applied successfully');
    } catch (error) {
      console.error('Error applying settings:', error);
    }
  }, [localParticipant, previewCameraEnabled, previewMicEnabled, previewIsMirrored, backgroundType]);

  // Test audio output
  const testAudioOutput = () => {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Close modal and cleanup
  const handleClose = () => {
    // Cleanup streams
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (previewAudioStream) {
      previewAudioStream.getTracks().forEach(track => track.stop());
      setPreviewAudioStream(null);
    }
    
    // Use the onClose prop if provided, otherwise fallback to layout context
    if (onClose) {
      onClose();
    } else {
      layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' });
    }
  };

  // Save and close
  const handleSave = async () => {
    await applySettings();
    handleClose();
  };

  // Device selection handlers
  const handleVideoDeviceSelect = (device: MediaDeviceInfo) => {
    setSelectedVideoDevice({ id: device.deviceId, label: device.label });
    setShowVideoDropdown(false);
  };

  const handleAudioDeviceSelect = (device: MediaDeviceInfo) => {
    setSelectedAudioDevice({ id: device.deviceId, label: device.label });
    setShowAudioDropdown(false);
  };

  const handleOutputDeviceSelect = (device: MediaDeviceInfo) => {
    setSelectedAudioOutput({ id: device.deviceId, label: device.label });
    setShowOutputDropdown(false);
  };

  return (
    <div 
      className="bg-[#1a1a1a] border border-[rgba(55,65,81,0.3)] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl z-[3100] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[rgba(55,65,81,0.3)]">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-gray-400" />
          <h2 className="text-xl font-semibold text-white">Meeting Settings</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8">
          
                      {/* Camera Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white border-b border-[rgba(55,65,81,0.3)] pb-2">
                Camera
              </h3>
            
                          {/* Camera Preview */}
              <div className="space-y-3">
                <div className="text-sm text-gray-400">Preview</div>
                <div className="relative w-full aspect-video bg-[#000000] rounded-lg border border-[rgba(55,65,81,0.3)] overflow-hidden">
                {previewCameraEnabled && localParticipant?.isCameraEnabled && camTrackRef ? (
                  <VideoTrack
                    trackRef={camTrackRef}
                    className={cn(
                      "w-full h-full object-cover",
                      previewIsMirrored && "scale-x-[-1]"
                    )}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <VideoOff size={48} className="mx-auto mb-2" />
                      <p className="text-sm">
                        {previewCameraEnabled ? 'Starting Camera...' : 'Camera Off'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Camera Controls */}
            <div className="space-y-3">
              {/* First Row: Camera toggle and device selection */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setPreviewCameraEnabled(!previewCameraEnabled)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                    previewCameraEnabled 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-transparent hover:bg-white/10 text-red-500 border border-[#374151]"
                  )}
                >
                  {previewCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                  {previewCameraEnabled ? 'Turn Off' : 'Turn On'}
                </Button>
                
                <div className="flex-1 relative">
                  <Button
                    variant="outline"
                    onClick={() => setShowVideoDropdown(!showVideoDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left bg-[#2a2a2a] border-[#374151] text-white hover:bg-[#374151]"
                  >
                    <span className="truncate">{selectedVideoDevice.label}</span>
                    <ChevronDown size={16} className="text-gray-400 ml-2 shrink-0" />
                  </Button>
                  {showVideoDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#374151] rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                      {availableDevices.video.map((device) => (
                        <button
                          key={device.deviceId}
                          onClick={() => handleVideoDeviceSelect(device)}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {device.label || 'Unknown Camera'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Second Row: Mirror and Blur controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewIsMirrored(!previewIsMirrored)}
                  className={cn(
                    "settings-btn flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                    previewIsMirrored 
                      ? "bg-gray-600 hover:bg-gray-700 text-white" 
                      : "bg-transparent hover:bg-white/10 text-white border border-gray-600"
                  )}
                >
                  <FlipHorizontal size={14} />
                  Mirror
                </button>
                
                <button
                  onClick={() => setPreviewBlurEnabled(!previewBlurEnabled)}
                  className={cn(
                    "settings-btn flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                    previewBlurEnabled 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-transparent hover:bg-white/10 text-white border border-[rgba(55,65,81,0.3)]"
                  )}
                >
                  <Sparkles size={14} />
                  {previewBlurEnabled ? 'Blur On' : 'Blur Off'}
                </button>
              </div>
            </div>
          </div>

          {/* Microphone Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
              Microphone
            </h3>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewMicEnabled(!previewMicEnabled)}
                className={cn(
                  "settings-btn flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                  previewMicEnabled 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-transparent hover:bg-white/10 text-red-500 border border-gray-600"
                )}
              >
                {previewMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                {previewMicEnabled ? 'Turn Off' : 'Turn On'}
              </button>
              
              <div className="flex-1 relative">
                <button
                  onClick={() => setShowAudioDropdown(!showAudioDropdown)}
                  className="settings-btn w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left"
                >
                  <span className="truncate">{selectedAudioDevice.label}</span>
                  <ChevronDown size={16} className="text-muted-foreground ml-2 shrink-0" />
                </button>
                {showAudioDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                    {availableDevices.audio.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleAudioDeviceSelect(device)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {device.label || 'Unknown Microphone'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audio Level Visualization */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  previewMicEnabled ? "bg-green-500" : "bg-red-500"
                )} />
                <span className="text-sm text-gray-300">
                  Microphone {previewMicEnabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex items-end gap-1 h-12">
                {audioLevels.map((level, index) => (
                  <div
                    key={index}
                    className={cn(
                      "w-2 rounded-sm transition-all duration-100",
                      previewMicEnabled && level > 0.1 ? "bg-green-500" : "bg-gray-600"
                    )}
                    style={{
                      height: `${Math.max(4, level * 48)}px`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Speaker Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2">
              Speaker
            </h3>
            
            <div className="flex items-center gap-3">
              <button
                onClick={testAudioOutput}
                className="settings-btn bg-transparent hover:bg-white/10 text-white border border-gray-600 flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
              >
                <TestTube size={16} />
                Test Audio
              </button>
              
              <div className="flex-1 relative">
                <button
                  onClick={() => setShowOutputDropdown(!showOutputDropdown)}
                  className="settings-btn w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left"
                >
                  <span className="truncate">{selectedAudioOutput.label}</span>
                  <ChevronDown size={16} className="text-muted-foreground ml-2 shrink-0" />
                </button>
                {showOutputDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                    {availableDevices.output.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleOutputDeviceSelect(device)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {device.label || 'Unknown Speaker'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-6 border-t border-[rgba(55,65,81,0.3)]">
                  <Button
            variant="outline"
            onClick={handleClose}
            className="bg-transparent border-[rgba(55,65,81,0.3)] text-white hover:bg-white/10"
          >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Apply Settings
        </Button>
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
