'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { UnifiedMeetingSummary } from '@/app/components/UnifiedMeetingSummary';

export default function MeetingSummaryPage() {
  const params = useParams();
  const meetingId = params?.meetingId as string;

  if (!meetingId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#0a0a0a',
        color: '#ffffff'
      }}>
        <p>Meeting ID not found</p>
      </div>
    );
  }

  return (
    <UnifiedMeetingSummary
      meetingId={meetingId}
      isModal={false}
    />
  );
} 