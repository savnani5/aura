import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/prisma';

const dbService = DatabaseService.getInstance();

// GET /api/meetings/[roomName] - Get meeting data
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

    const meeting = await dbService.getMeeting(roomName);
    
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting
    });

  } catch (error) {
    console.error('Error fetching meeting:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch meeting',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/meetings/[roomName] - Join meeting / Add participant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const body = await request.json();
    const { participantName, isHost } = body;

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Room name and participant name are required' },
        { status: 400 }
      );
    }

    // Get or create meeting first
    const meeting = await dbService.getMeeting(roomName);
    
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found. Create the meeting first.' },
        { status: 404 }
      );
    }

    // Add participant
    const participant = await dbService.addParticipant(
      meeting.id, 
      participantName, 
      isHost || false
    );

    // Start meeting if this is the first participant
    if (!meeting.startedAt) {
      await dbService.startMeeting(roomName);
    }

    return NextResponse.json({
      success: true,
      participant,
      meeting: await dbService.getMeeting(roomName)
    });

  } catch (error) {
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add participant',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/meetings/[roomName] - Update meeting (e.g., end meeting)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const body = await request.json();
    const { action, participantName } = body;

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const meeting = await dbService.getMeeting(roomName);
    
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    let updatedMeeting: NonNullable<typeof meeting> = meeting;

    switch (action) {
      case 'end_meeting':
        await dbService.endMeeting(roomName);
        const endedMeeting = await dbService.getMeeting(roomName);
        if (!endedMeeting) {
          return NextResponse.json(
            { error: 'Meeting not found after update' },
            { status: 404 }
          );
        }
        updatedMeeting = endedMeeting;
        break;
      
      case 'leave_meeting':
        if (!participantName) {
          return NextResponse.json(
            { error: 'Participant name required for leave action' },
            { status: 400 }
          );
        }
        await dbService.removeParticipant(meeting.id, participantName);
        const leftMeeting = await dbService.getMeeting(roomName);
        if (!leftMeeting) {
          return NextResponse.json(
            { error: 'Meeting not found after update' },
            { status: 404 }
          );
        }
        updatedMeeting = leftMeeting;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: end_meeting, leave_meeting' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      meeting: updatedMeeting!
    });

  } catch (error) {
    console.error('Error updating meeting:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update meeting',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 