import React from 'react';
import Image from 'next/image';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, VirtualBackground } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track } from 'livekit-client';

// Background image paths - ensure these are in public/background-images/
const BACKGROUND_IMAGES = [
  { 
    name: 'Desk', 
    url: '/background-images/samantha-gades-BlIhVfXbi9s-unsplash.jpg'
  },
  { 
    name: 'Nature', 
    url: '/background-images/ali-kazal-tbw_KQE3Cbg-unsplash.jpg'
  },
];

// Background options
type BackgroundType = 'none' | 'blur' | 'image';

export function CameraSettings() {
  const { cameraTrack, localParticipant } = useLocalParticipant();
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>(
    (cameraTrack as LocalTrackPublication)?.track?.getProcessor()?.name === 'background-blur'
      ? 'blur'
      : (cameraTrack as LocalTrackPublication)?.track?.getProcessor()?.name === 'virtual-background'
      ? 'image'
      : 'none',
  );

  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(
    null,
  );

  const [imagesLoaded, setImagesLoaded] = React.useState(false);

  // Preload background images
  React.useEffect(() => {
    const loadImages = async () => {
      console.log('Starting to preload background images...');
      const imagePromises = BACKGROUND_IMAGES.map((image) => {
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            console.log(`✅ Successfully loaded background image: ${image.url}`);
            resolve(img);
          };
          img.onerror = () => {
            console.error(`❌ Failed to load background image: ${image.url}`);
            // Try to provide more detailed error information
            fetch(image.url)
              .then(response => {
                console.log(`Image fetch response for ${image.url}:`, response.status, response.statusText);
              })
              .catch(fetchError => {
                console.error(`Fetch error for ${image.url}:`, fetchError);
              });
            resolve(null); // Don't reject, just resolve with null
          };
          img.src = image.url;
        });
      });

      try {
        const results = await Promise.all(imagePromises);
        const loadedCount = results.filter(result => result !== null).length;
        console.log(`Preloaded ${loadedCount}/${BACKGROUND_IMAGES.length} background images`);
        setImagesLoaded(true);
      } catch (error) {
        console.error('Error preloading background images:', error);
        setImagesLoaded(true); // Still set to true to show UI
      }
    };

    loadImages();
  }, []);

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  const selectBackground = (type: BackgroundType, imagePath?: string) => {
    setBackgroundType(type);
    if (type === 'image' && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
    } else if (type !== 'image') {
      setVirtualBackgroundImagePath(null);
    }
  };

  React.useEffect(() => {
    if (isLocalTrack(cameraTrack?.track)) {
      if (backgroundType === 'blur') {
        cameraTrack.track?.setProcessor(BackgroundBlur());
      } else if (backgroundType === 'image' && virtualBackgroundImagePath) {
        cameraTrack.track?.setProcessor(VirtualBackground(virtualBackgroundImagePath));
      } else {
        cameraTrack.track?.stopProcessor();
      }
    }
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {camTrackRef && (
        <VideoTrack
          style={{
            maxHeight: '280px',
            objectFit: 'contain',
            objectPosition: 'right',
            transform: 'scaleX(-1)',
          }}
          trackRef={camTrackRef}
        />
      )}

      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
        </div>
      </section>

      <div style={{ marginTop: '10px' }}>
        <div style={{ marginBottom: '8px' }}>Background Effects</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => selectBackground('none')}
            className="lk-button"
            aria-pressed={backgroundType === 'none'}
            style={{
              border: backgroundType === 'none' ? '2px solid #0090ff' : '1px solid #d1d1d1',
              minWidth: '80px',
            }}
          >
            None
          </button>

          <button
            onClick={() => selectBackground('blur')}
            className="lk-button"
            aria-pressed={backgroundType === 'blur'}
            style={{
              border: backgroundType === 'blur' ? '2px solid #0090ff' : '1px solid #d1d1d1',
              minWidth: '80px',
              backgroundColor: '#f0f0f0',
              position: 'relative',
              overflow: 'hidden',
              height: '60px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#e0e0e0',
                filter: 'blur(8px)',
                zIndex: 0,
              }}
            />
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              Blur
            </span>
          </button>

          {BACKGROUND_IMAGES.map((image) => (
            <button
              key={image.url}
              onClick={() => selectBackground('image', image.url)}
              className="lk-button"
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.url
              }
              style={{
                backgroundImage: `url(${image.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '80px',
                height: '60px',
                border:
                  backgroundType === 'image' && virtualBackgroundImagePath === image.url
                    ? '2px solid #0090ff'
                    : '1px solid #d1d1d1',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onError={(e) => {
                console.error(`Failed to load background image: ${image.url}`);
                e.currentTarget.style.backgroundColor = '#e0e0e0';
                e.currentTarget.style.backgroundImage = 'none';
              }}
            >
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'white',
                }}
              >
                {image.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
