import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/meeting-status/[meetingId] - Quick status check for meeting processing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const db = DatabaseService.getInstance();
    
    const meeting = await db.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({
        success: false,
        error: 'Meeting not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        meetingId: meeting._id,
        status: meeting.status,
        processingStatus: meeting.processingStatus,
        processingStartedAt: meeting.processingStartedAt,
        processingCompletedAt: meeting.processingCompletedAt,
        processingError: meeting.processingError,
        title: meeting.title,
        hasSummary: !!meeting.summary
      }
    });

  } catch (error) {
    console.error('Error checking meeting status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check meeting status'
    }, { status: 500 });
  }
}