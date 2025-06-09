import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, CreateMeetingData } from '@/lib/prisma';

const dbService = DatabaseService.getInstance();

// GET /api/meetings - Get all meetings
export async function GET() {
  try {
    const meetings = await dbService.getAllMeetings();
    
    return NextResponse.json({
      success: true,
      meetings
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch meetings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/meetings - Create or get a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, title, type, isRecurring, recurringPattern } = body;

    // Validation
    if (!roomName || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, type' },
        { status: 400 }
      );
    }

    // Basic validation - type should be a non-empty string
    if (typeof type !== 'string' || type.trim().length === 0) {
      return NextResponse.json(
        { error: 'Meeting type must be a non-empty string' },
        { status: 400 }
      );
    }

    const meetingData: CreateMeetingData = {
      roomName,
      title,
      type: type.trim(), // Clean up the type string
      isRecurring: isRecurring || false,
      recurringPattern
    };

    const meeting = await dbService.createOrGetMeeting(meetingData);

    return NextResponse.json({
      success: true,
      meeting,
      isNew: meeting.createdAt.getTime() === meeting.updatedAt.getTime()
    });

  } catch (error) {
    console.error('Error creating/getting meeting:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create or get meeting',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 