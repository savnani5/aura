import * as React from 'react';
import { MeetingRoomDashboard } from '@/app/meetingroom/[roomName]/MeetingRoomDashboard';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomName: string }>;
}) {
  const { roomName } = await params;

  return <MeetingRoomDashboard roomName={roomName} />;
} 