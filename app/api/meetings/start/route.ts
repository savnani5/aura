import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

// Simple in-memory lock to prevent race conditions during meeting creation
const meetingStartLocks = new Map<string, Promise<any>>();

// Helper function to acquire a lock for meeting start processing
async function withMeetingStartLock<T>(roomName: string, operation: () => Promise<T>): Promise<T> {
  // Check if there's already an operation in progress for this room
  const existingLock = meetingStartLocks.get(roomName);
  if (existingLock) {
    console.log(`🔒 Meeting start for room ${roomName} is already being processed, waiting for completion...`);
    
    try {
      // Wait for the existing operation to complete and return its result
      const result = await existingLock;
      console.log(`✅ Meeting start for room ${roomName} completed by another request`);
      return result;
    } catch (error) {
      console.log(`❌ Previous meeting start failed for room ${roomName}, continuing with new attempt`);
      // If the previous operation failed, we'll try again
    }
  }

  // Create a new lock for this operation
  const operationPromise = operation();
  meetingStartLocks.set(roomName, operationPromise);

  try {
    const result = await operationPromise;
    return result;
  } finally {
    // Always clean up the lock when done
    meetingStartLocks.delete(roomName);
  }
}

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
    if (!roomName || !roomId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomName, roomId' 
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

    // Use lock mechanism to prevent race conditions during meeting creation
    return await withMeetingStartLock(roomName, async () => {
      const db = DatabaseService.getInstance();
      
      // Check for existing active meeting first (inside lock)
      const existingActiveMeeting = await db.getActiveMeetingByRoom(roomName);
      if (existingActiveMeeting) {
        console.log(`⚠️ Active meeting already exists for room ${roomName}: ${existingActiveMeeting._id}`);
        
        // Return the existing meeting info instead of creating a new one
        return NextResponse.json({ 
          success: true, 
          message: 'Joined existing active meeting',
          data: {
            meetingId: existingActiveMeeting._id,
            roomName: existingActiveMeeting.roomName,
            title: existingActiveMeeting.title,
            type: existingActiveMeeting.type,
            startedAt: existingActiveMeeting.startedAt,
            isExisting: true // Flag to indicate this was an existing meeting
          }
        });
      }
      
      // Get the meeting room details
      const meetingRoom = await db.getMeetingRoomByName(roomId);
      if (!meetingRoom) {
        return NextResponse.json({ 
          success: false, 
          error: 'Meeting room not found' 
        }, { status: 404 });
      }
      
      console.log(`🚀 Creating new meeting for room ${roomName}`);
      
      // Create the meeting record (only if no active meeting exists)
      const meetingData = {
        roomId: meetingRoom._id,
        roomName: roomName,
        title: 'Meeting in process', // Temporary title for live meetings
        type: type || meetingRoom.type || 'Meeting',
        startedAt: new Date(),
        participants: participantName ? [{
          name: participantName,
          joinedAt: new Date(),
          isHost: true
        }] : [],
        transcripts: [], // Will be populated during/after the meeting
        summary: undefined, // Will be generated after the meeting
        isRecording: false,
        isLive: true // Flag to indicate this is a live meeting
      };

      const createdMeeting = await db.createMeeting(meetingData);
      
      console.log(`✅ Created new meeting: ${createdMeeting._id} for room ${roomName}`);
      
      return NextResponse.json({ 
        success: true, 
        message: 'New meeting created successfully',
        data: {
          meetingId: createdMeeting._id,
          roomName: createdMeeting.roomName,
          title: createdMeeting.title,
          type: createdMeeting.type,
          startedAt: createdMeeting.startedAt,
          isExisting: false // Flag to indicate this is a new meeting
        }
      }, { status: 201 });
    });
    
  } catch (error) {
    console.error('Error starting meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start meeting' 
    }, { status: 500 });
  }
} 