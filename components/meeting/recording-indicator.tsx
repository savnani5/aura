import { useIsRecording } from '@livekit/components-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export function RecordingIndicator() {
  const isRecording = useIsRecording();
  const [wasRecording, setWasRecording] = React.useState(false);

  React.useEffect(() => {
    if (isRecording !== wasRecording) {
      setWasRecording(isRecording);
      if (isRecording) {
        toast('This meeting is being recorded', {
          duration: 3000,
          icon: '🎥',
          position: 'top-center',
          style: {
            backgroundColor: '#dc2626',
            color: 'white',
          },
        });
      }
    }
  }, [isRecording]);

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        isRecording && "shadow-[inset_0_0_0_3px_#dc2626]"
      )}
    />
  );
}
