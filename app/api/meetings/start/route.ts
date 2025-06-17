import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// POST /api/meetings/start - Create a meeting record when starting/joining a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      roomName, 
      roomId, 
      title, 
      type, 
      participantName,
      isUpcoming = false // Whether this is joining an upcoming meeting or starting a new one
    } = body;

    // Validate required fields
    if (!roomName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required field: roomName' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    // Get the meeting room details if roomId is provided
    let meetingRoom = null;
    if (roomId) {
      meetingRoom = await db.getMeetingRoomByName(roomId);
    }
    
    // Create the meeting record
    const meetingData = {
      roomId: meetingRoom?._id, // Optional for one-off meetings
      roomName: roomName,
      title: title || meetingRoom?.title || 'Meeting',
      type: type || meetingRoom?.type || 'Meeting',
      isOneOff: !meetingRoom, // True if no associated meeting room
      startedAt: new Date(),
      participants: participantName ? [{
        name: participantName,
        joinedAt: new Date(),
        isHost: true
      }] : [],
      transcripts: [], // Will be populated during/after the meeting
      summary: undefined, // Will be generated after the meeting
      isRecording: false
    };

    const createdMeeting = await db.createMeeting(meetingData);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        meetingId: createdMeeting._id,
        roomName: createdMeeting.roomName,
        title: createdMeeting.title,
        type: createdMeeting.type,
        startedAt: createdMeeting.startedAt
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error starting meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start meeting' 
    }, { status: 500 });
  }
} 