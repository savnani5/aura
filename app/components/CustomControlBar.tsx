import React from 'react';
import {
  TrackToggle,
  ChatToggle,
  ChatIcon,
  LeaveIcon,
  MediaDeviceMenu,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  useMaybeLayoutContext,
  useDisconnectButton,
} from '@livekit/components-react';
import { supportsScreenSharing } from '@livekit/components-core';
import { TranscriptToggle } from './TranscriptToggle';

export function CustomControlBar() {
  const layoutContext = useMaybeLayoutContext();
  const localPermissions = useLocalParticipantPermissions();
  const { buttonProps } = useDisconnectButton({ stopTracks: true });
  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: false });

  const microphoneOnChange = (enabled: boolean, isUserInitiated: boolean) =>
    isUserInitiated ? saveAudioInputEnabled(enabled) : null;
  const cameraOnChange = (enabled: boolean, isUserInitiated: boolean) =>
    isUserInitiated ? saveVideoInputEnabled(enabled) : null;
  const onScreenShareChange = (enabled: boolean) => setIsScreenShareEnabled(enabled);

  const showIcon = true;
  const showText = true;
  const browserSupportsScreenSharing = supportsScreenSharing();

  return (
    <div className="lk-control-bar">
      {/* Microphone */}
      {localPermissions?.canPublish && (
        <div className="lk-button-group">
          <TrackToggle source="microphone" showIcon={showIcon} onChange={microphoneOnChange}>
            {showText && 'Microphone'}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) => saveAudioInputDeviceId(deviceId ?? '')}
            />
          </div>
        </div>
      )}
      {/* Camera */}
      {localPermissions?.canPublish && (
        <div className="lk-button-group">
          <TrackToggle source="camera" showIcon={showIcon} onChange={cameraOnChange}>
            {showText && 'Camera'}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) => saveVideoInputDeviceId(deviceId ?? '')}
            />
          </div>
        </div>
      )}
      {/* Screen Share */}
      {localPermissions?.canPublish && browserSupportsScreenSharing && (
        <TrackToggle
          source="screen_share"
          captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          showIcon={showIcon}
          onChange={onScreenShareChange}
        >
          {showText && (isScreenShareEnabled ? 'Stop screen share' : 'Share screen')}
        </TrackToggle>
      )}
      {/* Chat */}
      {localPermissions?.canPublishData && (
        <ChatToggle>
          {showIcon && <ChatIcon />}
          {showText && 'Chat'}
        </ChatToggle>
      )}
      {/* Transcript */}
      <TranscriptToggle>
        {showText && 'Transcript'}
      </TranscriptToggle>
      {/* Leave */}
      <button {...buttonProps} className={buttonProps.className}>
        {showIcon && <LeaveIcon />}
        {showText && 'Leave'}
      </button>
    </div>
  );
} 