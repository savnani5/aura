import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase, Meeting } from '@/lib/mongodb';

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

    await connectToDatabase();
    
    // Find the meeting
    const meeting = await Meeting.findOne({
      _id: meetingId,
      roomName: roomName
    });

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }

    // Check if meeting has ended and has a summary
    if (meeting.endedAt && meeting.summary?.content) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'completed',
          summary: meeting.summary,
          meetingId: meeting._id
        }
      });
    }

    // Check if meeting has ended but summary is still being generated
    if (meeting.endedAt && !meeting.summary?.content) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'generating_summary',
          message: 'Meeting has ended, summary is being generated...'
        }
      });
    }

    // Meeting is still active
    return NextResponse.json({
      success: true,
      data: {
        status: 'active',
        message: 'Meeting is still active'
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