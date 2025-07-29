import { SimpleMeetingView } from '@/components/workspace/simple-meeting-view';

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function MeetingSummaryPage({ params }: PageProps) {
  const { meetingId } = await params;
  
  return <SimpleMeetingView meetingId={meetingId} />;
} 