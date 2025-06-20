import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// GET /api/meetings/[roomName]/history - Get meeting history and upcoming meetings for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter');
    
    const db = DatabaseService.getInstance();
    
    // Get the meeting room
    const room = await db.getMeetingRoomByName(roomName);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Meeting room not found'
      }, { status: 404 });
    }
    
    // Build date query based on filter
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
        startedAt: { $gte: weekAgo }
      };
    }
    
    // Get historical meetings using optimized metadata query (no transcripts by default)
    const historicalMeetings = await db.getMeetingMetadata(room._id, {
      limit: 50,
      // Only include transcripts if specifically requested (adds query param support)
      includeTranscripts: searchParams.get('includeTranscripts') === 'true'
    });
    
    // Filter out meetings with no content (no transcripts and no summary)
    const meetingsWithContent = historicalMeetings.filter(meeting => {
      const hasTranscripts = meeting.transcriptCount > 0;
      const hasSummary = meeting.summary && meeting.summary.content && meeting.summary.content.trim().length > 0;
      return hasTranscripts || hasSummary;
    });
    
    // Calculate upcoming meetings for recurring rooms
    const upcomingMeetings = [];
    if (room.isRecurring && room.recurringPattern) {
      const nextMeetingDate = db.calculateNextMeetingDate(room);
      if (nextMeetingDate) {
        upcomingMeetings.push({
          id: `upcoming-${nextMeetingDate.getTime()}`,
          roomName: room.roomName,
          title: room.title,
          type: room.type,
          startTime: nextMeetingDate.toISOString(),
          isUpcoming: true,
          recurringPattern: {
            frequency: room.recurringPattern.frequency || '',
            day: room.recurringPattern.day || '',
            time: room.recurringPattern.time || ''
          },
          participants: room.participants.map(p => ({
            name: p.name,
            joinedAt: nextMeetingDate.toISOString(),
            isHost: p.role === 'host'
          }))
        });
      }
    }
    
    // Transform historical meetings to match frontend interface
    const transformedHistoricalMeetings = meetingsWithContent.map(meeting => ({
      id: meeting._id,
      roomName: meeting.roomName,
      title: meeting.title || meeting.type,
      type: meeting.type,
      startTime: meeting.startedAt.toISOString(),
      endTime: meeting.endedAt?.toISOString(),
      duration: meeting.duration,
      isUpcoming: false,
      participants: meeting.participants || [],
      summary: meeting.summary ? {
        content: meeting.summary.content,
        keyPoints: meeting.summary.keyPoints || [],
        actionItems: meeting.summary.actionItems || [],
        decisions: meeting.summary.decisions || []
      } : undefined,
      // Only include transcripts if they were requested and available
      transcripts: (meeting as any).transcripts || []
    }));
    
    // Combine and sort all meetings (upcoming first, then historical by date)
    const allMeetings = [
      ...upcomingMeetings,
      ...transformedHistoricalMeetings
    ];
    
    return NextResponse.json({
      success: true,
      data: allMeetings
    });
    
  } catch (error) {
    console.error('Error fetching meeting history:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch meeting history'
    }, { status: 500 });
  }
} 