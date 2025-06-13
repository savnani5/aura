import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, fromCreateMeetingForm, toMeetingRoomCard, toOneOffMeeting } from '@/lib/mongodb';

// GET /api/meetings - Get meeting rooms or one-off meetings based on query params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'instant' for one-off meetings
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    
    const db = DatabaseService.getInstance();
    
    if (type === 'instant') {
      // Fetch one-off meetings
      const oneOffMeetings = await db.getOneOffMeetings(limit);
      const formattedMeetings = oneOffMeetings.map(meeting => toOneOffMeeting(meeting));
      
      return NextResponse.json({ 
        success: true, 
        data: formattedMeetings 
      });
    } else {
      // Default: fetch meeting rooms
      const meetingRooms = await db.getAllMeetingRooms(limit);
      const formattedRooms = meetingRooms.map(room => toMeetingRoomCard(room));
      
      return NextResponse.json({ 
        success: true, 
        data: formattedRooms 
      });
    }
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch meetings' 
    }, { status: 500 });
  }
}

// POST /api/meetings - Create a new meeting room OR one-off meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      roomName, 
      title, 
      type, 
      isRecurring, 
      participants, 
      startDate, 
      endDate, 
      frequency, 
      recurringDay, 
      recurringTime,
      participantName // For instant meetings
    } = body;

    // Validate required fields
    if (!roomName || !title || !type) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomName, title, type' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    if (isRecurring === false) {
      // Create one-off meeting
      const oneOffMeeting = await db.createOneOffMeeting({
        roomName,
        title,
        type,
        participantName
      });
      
      return NextResponse.json({ 
        success: true, 
        data: toOneOffMeeting(oneOffMeeting) 
      }, { status: 201 });
    } else {
      // Create meeting room (existing logic)
      
      // Check if room already exists
      const existingRoom = await db.getMeetingRoomByName(roomName);
      if (existingRoom) {
        return NextResponse.json({ 
          success: false, 
          error: 'Meeting room with this name already exists' 
        }, { status: 409 });
      }

      // Create meeting room
      const roomData = fromCreateMeetingForm({
        roomName,
        title,
        type,
        isRecurring: isRecurring || false,
        participants: participants || [],
        startDate,
        endDate,
        frequency,
        recurringDay,
        recurringTime
      });

      const createdRoom = await db.createMeetingRoom(roomData);
      
      return NextResponse.json({ 
        success: true, 
        data: toMeetingRoomCard(createdRoom) 
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create meeting' 
    }, { status: 500 });
  }
} 