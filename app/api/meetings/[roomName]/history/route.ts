import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// GET /api/meetings/[roomName]/history - Get meeting history for a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter');
    
    const db = DatabaseService.getInstance();
    
    // Get the room first to check if it's recurring
    const room = await db.getMeetingRoomByName(roomName);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Meeting room not found'
      }, { status: 404 });
    }
    
    // Build date filter query
    let dateQuery = {};
    
    if (dateFilter === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      dateQuery = {
        startedAt: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      };
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      dateQuery = {
        startedAt: {
          $gte: weekAgo
        }
      };
    }
    
    // Fetch past meetings
    const pastMeetings = await db.getMeetingsByRoomWithFilters({
      roomId: room._id,
      dateQuery: {
        ...dateQuery,
        endedAt: { $exists: true } // Only completed meetings
      },
      limit: 50
    });
    
    let upcomingMeeting = null;
    
    // If it's a recurring room, calculate the next meeting
    if (room.isRecurring && room.recurringPattern) {
      const nextMeetingDate = db.calculateNextMeetingDate(room);
      if (nextMeetingDate) {
        upcomingMeeting = {
          id: 'upcoming',
          roomName: room.roomName,
          title: room.title,
          type: room.type,
          startTime: nextMeetingDate.toISOString(),
          isUpcoming: true,
          participants: room.participants || [],
          recurringPattern: room.recurringPattern
        };
      }
    }
    
    // Transform past meetings data
    const transformedMeetings = pastMeetings.map((meeting: any) => ({
      id: meeting._id,
      roomName: meeting.roomName,
      title: meeting.title || meeting.type,
      type: meeting.type,
      startTime: meeting.startedAt,
      endTime: meeting.endedAt,
      duration: meeting.duration,
      participants: meeting.participants || [],
      summary: meeting.summary ? {
        content: meeting.summary.content,
        keyPoints: meeting.summary.keyPoints || [],
        actionItems: meeting.summary.actionItems || [],
        decisions: meeting.summary.decisions || []
      } : undefined,
      transcripts: meeting.transcripts || []
    }));
    
    // Combine upcoming and past meetings
    const allMeetings = upcomingMeeting 
      ? [upcomingMeeting, ...transformedMeetings]
      : transformedMeetings;
    
    return NextResponse.json({
      success: true,
      data: allMeetings,
      meta: {
        isRecurring: room.isRecurring,
        hasUpcoming: !!upcomingMeeting,
        pastMeetingsCount: transformedMeetings.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching meeting history:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch meeting history'
    }, { status: 500 });
  }
} 