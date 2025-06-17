'use client';

import React from 'react';
import { UnifiedMeetingSummary } from '@/app/components/UnifiedMeetingSummary';

interface MeetingModalProps {
  meetingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MeetingModal({ meetingId, isOpen, onClose }: MeetingModalProps) {
  return (
    <UnifiedMeetingSummary
      meetingId={meetingId}
      isModal={true}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
} 