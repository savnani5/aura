import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/prisma';

const dbService = DatabaseService.getInstance();

// GET /api/meetings/[roomName]/details - Get detailed meeting data with transcripts and summaries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Get meeting with all related data
    const meeting = await dbService.getMeeting(roomName);
    
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the frontend interface
    const meetingDetails = {
      id: meeting.id,
      roomName: meeting.roomName,
      title: meeting.title || `${meeting.type} Meeting`,
      type: meeting.type,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      participants: meeting.participants.map(p => ({
        id: p.id,
        participantName: p.participantName,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        isHost: p.isHost
      })),
      transcripts: meeting.transcripts.map(t => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
        timestamp: t.timestamp
      })),
      summaries: meeting.summaries.map(s => ({
        id: s.id,
        summary: s.summary,
        keyPoints: s.keyPoints,
        actionItems: s.actionItems,
        decisions: s.decisions,
        generatedAt: s.generatedAt,
        aiModel: s.aiModel
      }))
    };

    return NextResponse.json({
      success: true,
      meeting: meetingDetails
    });

  } catch (error) {
    console.error('Error fetching meeting details:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch meeting details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 