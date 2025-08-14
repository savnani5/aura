import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { LiveKitRoomService } from '@/lib/services/livekit-room-service';

/**
 * Check if a room is empty and end the meeting if needed
 * This replaces participant-based tracking with actual LiveKit room state
 */
export async function POST(request: NextRequest) {
  try {
    const { roomName, force = false } = await request.json();
    
    if (!roomName) {
      return NextResponse.json({
        success: false,
        error: 'roomName is required'
      }, { status: 400 });
    }

    console.log(`🔍 ROOM STATUS CHECK: Checking room ${roomName} (force=${force})`);

    const liveKitService = LiveKitRoomService.getInstance();
    const dbService = DatabaseService.getInstance();

    // Get the active meeting from database
    const activeMeeting = await dbService.getActiveMeetingByRoom(roomName);
    
    if (!activeMeeting) {
      console.log(`📋 ROOM STATUS CHECK: No active meeting found for room ${roomName}`);
      return NextResponse.json({
        success: true,
        message: 'No active meeting found',
        roomEmpty: true,
        meetingEnded: false
      });
    }

    console.log(`📋 ROOM STATUS CHECK: Found active meeting ${activeMeeting._id} (status: ${activeMeeting.status})`);

    // Check actual LiveKit room state
    const roomInfo = await liveKitService.getRoomParticipants(roomName);
    const isRoomEmpty = !roomInfo || roomInfo.participantCount === 0;

    console.log(`🏠 ROOM STATUS CHECK: Room ${roomName} - Empty: ${isRoomEmpty}, Participants: ${roomInfo?.participantCount || 0}`);

    // If room is empty (or force flag is set), end the meeting
    if (isRoomEmpty || force) {
      console.log(`🛑 ROOM STATUS CHECK: Ending meeting ${activeMeeting._id} - Room empty: ${isRoomEmpty}, Forced: ${force}`);

      // End the meeting atomically
      const endedMeeting = await dbService.atomicMeetingEnd(activeMeeting._id, {
        endedAt: new Date(),
        transcripts: activeMeeting.transcripts || [],
        participants: activeMeeting.participants || []
      });

      if (!endedMeeting) {
        console.error(`❌ ROOM STATUS CHECK: Failed to end meeting ${activeMeeting._id}`);
        return NextResponse.json({
          success: false,
          error: 'Failed to end meeting'
        }, { status: 500 });
      }

      // Trigger background processing
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000';
        
        const processingResponse = await fetch(`${baseUrl}/api/process-meeting`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId: activeMeeting._id,
            roomName,
            transcripts: activeMeeting.transcripts || [],
            participants: activeMeeting.participants || []
          })
        });
        
        if (processingResponse.ok) {
          console.log(`✅ ROOM STATUS CHECK: Processing triggered for meeting ${activeMeeting._id}`);
        } else {
          console.error(`❌ ROOM STATUS CHECK: Processing failed to trigger for meeting ${activeMeeting._id}:`, processingResponse.status);
        }
      } catch (error) {
        console.error(`❌ ROOM STATUS CHECK: Failed to trigger processing for meeting ${activeMeeting._id}:`, error);
      }

      // Clean up LiveKit room if it still exists
      try {
        if (!isRoomEmpty) {
          await liveKitService.disconnectAllParticipants(roomName);
        }
        // Optionally delete the room entirely
        // await liveKitService.deleteRoom(roomName);
      } catch (error) {
        console.warn(`⚠️ ROOM STATUS CHECK: Failed to clean up LiveKit room ${roomName}:`, error);
      }

      return NextResponse.json({
        success: true,
        message: 'Meeting ended successfully',
        roomEmpty: isRoomEmpty,
        meetingEnded: true,
        meetingId: activeMeeting._id,
        endedAt: endedMeeting.endedAt,
        backgroundProcessing: true
      });

    } else {
      // Room still has participants, meeting continues
      console.log(`👥 ROOM STATUS CHECK: Meeting ${activeMeeting._id} continues - ${roomInfo.participantCount} participants active`);
      
      return NextResponse.json({
        success: true,
        message: 'Meeting continues',
        roomEmpty: false,
        meetingEnded: false,
        participantCount: roomInfo.participantCount,
        participants: roomInfo.participants.map(p => ({
          identity: p.identity,
          name: p.name,
          state: p.state
        }))
      });
    }

  } catch (error) {
    console.error('❌ ROOM STATUS CHECK: Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check room status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to just check room status without ending meeting
 */
export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName');
    
    if (!roomName) {
      return NextResponse.json({
        success: false,
        error: 'roomName is required'
      }, { status: 400 });
    }

    const liveKitService = LiveKitRoomService.getInstance();
    const dbService = DatabaseService.getInstance();

    // Get the active meeting from database
    const activeMeeting = await dbService.getActiveMeetingByRoom(roomName);
    
    // Check actual LiveKit room state
    const roomInfo = await liveKitService.getRoomParticipants(roomName);
    const isRoomEmpty = !roomInfo || roomInfo.participantCount === 0;

    return NextResponse.json({
      success: true,
      roomName,
      hasActiveMeeting: !!activeMeeting,
      meetingId: activeMeeting?._id || null,
      meetingStatus: activeMeeting?.status || null,
      roomEmpty: isRoomEmpty,
      participantCount: roomInfo?.participantCount || 0,
      participants: roomInfo?.participants.map(p => ({
        identity: p.identity,
        name: p.name,
        state: p.state
      })) || []
    });

  } catch (error) {
    console.error('❌ ROOM STATUS GET: Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get room status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
