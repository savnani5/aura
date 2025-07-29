import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { roomName } = await params;
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'Meeting ID required' }, { status: 400 });
    }

    const dbService = DatabaseService.getInstance();
    
    // Find the meeting
    const meeting = await dbService.getMeetingById(meetingId);

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.roomName !== roomName) {
      return NextResponse.json({ success: false, error: 'Meeting does not belong to this room' }, { status: 400 });
    }

    // Check if meeting is still active (started but not ended)
    if (meeting.startedAt && !meeting.endedAt) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'active',
          message: 'Meeting is currently in progress',
          meetingId: meeting._id,
          startedAt: meeting.startedAt.toISOString(),
          title: meeting.title || meeting.type,
          participantCount: meeting.participants?.length || 0
        }
      });
    }

    // Check processing status for ended meetings
    if (meeting.endedAt) {
      const processingStatus = meeting.processingStatus || 'pending';
      
      switch (processingStatus) {
        case 'completed':
          return NextResponse.json({
            success: true,
            data: {
              status: 'completed',
              summary: meeting.summary,
              meetingId: meeting._id,
              endedAt: meeting.endedAt.toISOString(),
              duration: meeting.duration,
              hasTranscripts: meeting.hasEmbeddings || (meeting.transcriptCount && meeting.transcriptCount > 0)
            }
          });
          
        case 'failed':
          return NextResponse.json({
            success: true,
            data: {
              status: 'failed',
              message: 'Meeting processing failed',
              error: meeting.processingError,
              meetingId: meeting._id
            }
          });
          
        case 'pending':
        case 'in_progress':
        case 'summary_completed':
        default:
          return NextResponse.json({
            success: true,
            data: {
              status: 'processing',
              message: 'Meeting has ended, processing transcripts and generating summary...',
              processingStatus: processingStatus,
              meetingId: meeting._id,
              endedAt: meeting.endedAt.toISOString(),
              duration: meeting.duration
            }
          });
      }
    }

    // Fallback for meetings without proper timestamps
    return NextResponse.json({
      success: true,
      data: {
        status: 'unknown',
        message: 'Meeting status could not be determined',
        meetingId: meeting._id
      }
    });

  } catch (error) {
    console.error('Error checking meeting status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 