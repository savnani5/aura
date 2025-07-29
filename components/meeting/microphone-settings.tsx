import React from 'react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function MicrophoneSettings() {
  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } = useKrispNoiseFilter(
    // {
    //   filterOptions: {
    //     quality: 'high',
    //   },
    // },
  );

  React.useEffect(() => {
    // enable Krisp by default
    setNoiseFilterEnabled(true);
  }, []);
  return (
    <div className="flex flex-col gap-3 w-full">
      <section className="lk-button-group w-full">
        <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </section>

      <Button
        onClick={() => setNoiseFilterEnabled(!isNoiseFilterEnabled)}
        disabled={isNoiseFilterPending}
        variant={isNoiseFilterEnabled ? "default" : "outline"}
        size="sm"
        className="self-start text-sm"
      >
        <Sparkles size={16} className="mr-2" />
        {isNoiseFilterEnabled ? 'Disable' : 'Enable'} Enhanced Noise Cancellation
      </Button>
    </div>
  );
}
