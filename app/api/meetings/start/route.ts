import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

// POST /api/meetings/start - Start/join a meeting using atomic operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      roomName, 
      roomId, 
      title, 
      type, 
      participantName,
      participantId // LiveKit participant ID
    } = body;

    // Validate required fields
    if (!roomName || !roomId || !participantName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomName, roomId, participantName' 
      }, { status: 400 });
    }

    // Check user authentication and usage limits
    const { userId } = await auth();
    if (userId) {
      const db = DatabaseService.getInstance();
      const user = await db.getUserByClerkId(userId);
      
      if (user) {
        // Check if user has active subscription
        const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
        
        if (!hasActiveSubscription) {
          // Check usage limits for free users
          const usageCheck = await db.hasExceededMeetingLimit(userId, 10);
          
          if (usageCheck.exceeded) {
            return NextResponse.json({ 
              success: false, 
              error: 'Monthly meeting limit exceeded. Please upgrade to Pro for unlimited meetings.',
              usageData: usageCheck
            }, { status: 402 }); // Payment Required
          }
        }
      }
    }

    const db = DatabaseService.getInstance();
    
    // Get the meeting room details
    const meetingRoom = await db.getMeetingRoomByName(roomId);
    if (!meetingRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    // Try to start/join meeting atomically
    const meetingData = {
      roomId: meetingRoom._id,
      roomName: roomName,
      title: title || 'Meeting in progress',
      type: type || meetingRoom.type || 'Meeting',
      startedAt: new Date(),
      participants: [{
        name: participantName,
        joinedAt: new Date(),
        isHost: true
      }],
      transcripts: [],
      isRecording: false
    };

    const meeting = await db.atomicMeetingStart(roomName, meetingData);
    
    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create meeting' 
      }, { status: 500 });
    }

    // Check if this is a new meeting or existing one using the metadata
    const isNewMeeting = (meeting as any)._wasNewlyCreated;
    
    if (isNewMeeting) {
      console.log(`🚀 Created new meeting: ${meeting._id} for room ${roomName}`);
    } else {
      console.log(`✅ Joined existing meeting: ${meeting._id} for room ${roomName}`);
      // Note: Participant tracking is now handled by LiveKit webhooks and room state checks
    }

    return NextResponse.json({ 
      success: true, 
      message: isNewMeeting ? 'Meeting created successfully' : 'Joined existing meeting',
      data: {
        meetingId: meeting._id,
        roomName: meeting.roomName,
        title: meeting.title,
        type: meeting.type,
        startedAt: meeting.startedAt,
        status: meeting.status,
        isNewMeeting
        // Note: activeParticipantCount removed - use LiveKit room state instead
      }
    });

  } catch (error) {
    console.error('Error starting/joining meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start/join meeting' 
    }, { status: 500 });
  }
}