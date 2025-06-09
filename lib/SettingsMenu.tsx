'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
} from '@livekit/components-react';
import styles from '@/styles/SettingsMenu.module.css';
import { CameraSettings } from './CameraSettings';
import { MicrophoneSettings } from './MicrophoneSettings';

/**
 * @alpha
 * Updated Settings Menu Component - Latest Version
 */
export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @alpha
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;

  const settings = React.useMemo(() => {
    return {
      media: { camera: true, microphone: true, label: 'Media Devices', speaker: true },
      recording: recordingEndpoint ? { label: 'Recording' } : undefined,
    };
  }, [recordingEndpoint]);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => settings[t as keyof typeof settings] !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const isRecording = useIsRecording();
  const [initialRecStatus, setInitialRecStatus] = React.useState(isRecording);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);

  React.useEffect(() => {
    if (initialRecStatus !== isRecording) {
      setProcessingRecRequest(false);
    }
  }, [isRecording, initialRecStatus]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      throw TypeError('No recording endpoint specified');
    }
    if (room.isE2EEEnabled) {
      throw Error('Recording of encrypted meetings is currently not supported');
    }
    setProcessingRecRequest(true);
    setInitialRecStatus(isRecording);
    let response: Response;
    if (isRecording) {
      response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}`);
    } else {
      response = await fetch(recordingEndpoint + `/start?roomName=${room.name}`);
    }
    if (response.ok) {
      // Success - state will update via useIsRecording hook
    } else {
      console.error(
        'Error handling recording request, check server logs:',
        response.status,
        response.statusText,
      );
      setProcessingRecRequest(false);
    }
  };

  return (
    <div className={styles.settingsMenu} {...props}>
      {/* Tab Navigation */}
      <div className={styles.tabs}>
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                className={styles.tab}
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={tab === activeTab}
              >
                {
                  // @ts-ignore
                  settings[tab].label
                }
              </button>
            ),
        )}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'media' && (
          <>
            {settings.media && settings.media.camera && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Camera</h3>
                <div className={styles.sectionContent}>
                  <div className={styles.deviceControl}>
                    <div className={styles.deviceActions}>
                      <TrackToggle source={Track.Source.Camera} />
                      <CameraSettings />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {settings.media && settings.media.microphone && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Microphone</h3>
                <div className={styles.sectionContent}>
                  <div className={styles.deviceControl}>
                    <div className={styles.deviceActions}>
                      <TrackToggle source={Track.Source.Microphone} />
                      <MicrophoneSettings />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {settings.media && settings.media.speaker && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Speaker & Headphones</h3>
                <div className={styles.sectionContent}>
                  <div className={styles.deviceControl}>
                    <div className={styles.deviceLabel}>Audio Output</div>
                    <div className={styles.deviceActions}>
                      <MediaDeviceMenu kind="audiooutput" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'recording' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Record Meeting</h3>
            <div className={styles.sectionContent}>
              <div className={styles.recordingSection}>
                <div className={styles.recordingStatus}>
                  <div 
                    className={`${styles.recordingIndicator} ${
                      isRecording ? styles.active : styles.inactive
                    }`}
                  />
                  <p className={styles.recordingText}>
                    {isRecording
                      ? 'Meeting is currently being recorded'
                      : 'No active recordings for this meeting'}
                  </p>
                </div>
                <button 
                  className={`${styles.recordingButton} ${isRecording ? styles.stop : ''}`}
                  disabled={processingRecRequest} 
                  onClick={() => toggleRoomRecording()}
                >
                  {processingRecRequest 
                    ? (isRecording ? 'Stopping...' : 'Starting...') 
                    : (isRecording ? 'Stop Recording' : 'Start Recording')
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          className={styles.closeButton}
          onClick={() => layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' })}
        >
          Close Settings
        </button>
      </div>
    </div>
  );
}
