import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { MeetingProcessor } from '@/lib/services/meeting-processor';
import { LiveKitRoomService } from '@/lib/services/livekit-room-service';

/**
 * POST /api/meetings/[roomName]/end - Handle meeting end using LiveKit room state
 * This replaces database participant tracking with actual LiveKit room state
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    console.log('📡 MEETING END API: Received request for room:', roomName);
    
    let requestBody;
    try {
      const bodyText = await request.text();
      console.log('📡 MEETING END API: Raw request body:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('❌ MEETING END API: Empty request body received');
        return NextResponse.json({
          success: false,
          error: 'Empty request body'
        }, { status: 400 });
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('📡 MEETING END API: Parsed request body:', requestBody);
    } catch (parseError) {
      console.error('❌ MEETING END API: Failed to parse request body:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }
    
    const { 
      meetingId,
      action = 'end_meeting',
      participantId,
      transcripts = [],
      participants = [],
      force = false // Force end meeting regardless of participants
    } = requestBody;

    console.log('📡 MEETING END API: Extracted data:', {
      meetingId: meetingId || 'null',
      action,
      participantId: participantId || 'null',
      transcriptsCount: transcripts.length,
      participantsCount: participants.length,
      roomName,
      force
    });

    const dbService = DatabaseService.getInstance();
    const liveKitService = LiveKitRoomService.getInstance();

    // Get the active meeting
    const activeMeeting = await dbService.getActiveMeetingByRoom(roomName);
    if (!activeMeeting) {
      console.log(`📋 MEETING END: No active meeting found for room ${roomName}`);
      return NextResponse.json({
        success: true,
        message: 'No active meeting found',
        data: {
          meetingId: null,
          roomName,
          status: 'no_active_meeting'
        }
      });
    }

    console.log(`📋 MEETING END: Found active meeting ${activeMeeting._id} (status: ${activeMeeting.status})`);

    // If meeting is already ended/processing/completed, don't process again
    if (activeMeeting.status === 'ended' || activeMeeting.status === 'completed' || activeMeeting.status === 'processing') {
      console.log(`⚠️ MEETING END: Meeting ${activeMeeting._id} already in ${activeMeeting.status} state, skipping`);
      return NextResponse.json({
        success: true,
        message: `Meeting already ${activeMeeting.status}`,
        data: {
          meetingId: activeMeeting._id,
          roomName,
          status: activeMeeting.status,
          alreadyProcessed: true
        }
      });
    }

    const finalMeetingId = meetingId || activeMeeting._id;

    // Check actual LiveKit room state instead of database participant count
    let shouldEndMeeting = force;
    let participantCount = 0;
    let livekitParticipants: any[] = [];
    
    if (!force) {
      try {
        const roomInfo = await liveKitService.getRoomParticipants(roomName);
        participantCount = roomInfo?.participantCount || 0;
        livekitParticipants = roomInfo?.participants || [];
        shouldEndMeeting = participantCount === 0;
        
        console.log(`🔍 MEETING END: LiveKit room ${roomName} has ${participantCount} active participants`);
        
        if (participantCount > 0) {
          livekitParticipants.forEach(p => {
            console.log(`  - ${p.name || p.identity} (${p.state})`);
          });
        }
        
        if (!shouldEndMeeting) {
          console.log(`👥 MEETING END: Meeting continues - ${participantCount} participants still active`);
          return NextResponse.json({
            success: true,
            message: 'Meeting continues',
            data: {
              meetingId: finalMeetingId,
              roomName,
              participantCount,
              shouldEndMeeting: false,
              action: action,
              participants: livekitParticipants.map(p => ({
                identity: p.identity,
                name: p.name,
                state: p.state
              }))
            }
          });
        }
      } catch (error) {
        console.error(`❌ MEETING END: Error checking LiveKit room ${roomName}:`, error);
        // If we can't check LiveKit, don't end the meeting to be safe
        return NextResponse.json({
          success: false,
          error: 'Failed to check room status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }
    
    console.log(`🛑 MEETING END: Ending meeting ${finalMeetingId} - Room empty: ${participantCount === 0}, Force: ${force}`);

    // Calculate end time and duration
    const meetingEndedAt = new Date();
    const calculatedDuration = Math.round(
      (meetingEndedAt.getTime() - new Date(activeMeeting.startedAt).getTime()) / (1000 * 60)
    );

    // Use the transcripts and participants from the request or fall back to database
    const finalTranscripts = transcripts.length > 0 ? transcripts : (activeMeeting.transcripts || []);
    const finalParticipants = participants.length > 0 ? participants : (activeMeeting.participants || []);

    // Check if this is an empty meeting (no meaningful content)
    const hasTranscripts = finalTranscripts && finalTranscripts.length > 0;
    const hasParticipants = finalParticipants && finalParticipants.length > 1; // More than just the host
    const hasContent = hasTranscripts || hasParticipants;
    
    if (!hasContent) {
      console.log(`🗑️ MEETING END: No meaningful content found - deleting empty meeting: ${finalMeetingId}`, {
        transcriptCount: finalTranscripts?.length || 0,
        participantCount: finalParticipants?.length || 0
      });
      
      // Delete the empty meeting instead of processing it
      const deleteResult = await dbService.deleteMeeting(finalMeetingId);
      
      if (deleteResult) {
        console.log(`✅ MEETING END: Successfully deleted empty meeting: ${finalMeetingId}`);
        
        // Clean up LiveKit room
        try {
          if (participantCount > 0) {
            await liveKitService.disconnectAllParticipants(roomName);
          }
        } catch (error) {
          console.warn(`⚠️ MEETING END: Failed to clean up LiveKit room ${roomName}:`, error);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Empty meeting deleted successfully',
          data: {
            meetingId: finalMeetingId,
            roomName,
            deleted: true,
            reason: 'no_meaningful_content'
          }
        });
      } else {
        console.error(`❌ MEETING END: Failed to delete empty meeting: ${finalMeetingId}`);
        return NextResponse.json({
          success: false,
          error: 'Failed to delete empty meeting'
        }, { status: 500 });
      }
    }

    // End the meeting atomically
    const endedMeeting = await dbService.atomicMeetingEnd(finalMeetingId, {
      endedAt: meetingEndedAt,
      transcripts: finalTranscripts,
      participants: finalParticipants
    });

    if (!endedMeeting) {
      console.error(`❌ MEETING END: Failed to end meeting ${finalMeetingId}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to end meeting'
      }, { status: 500 });
    }

    console.log(`✅ MEETING END: Successfully ended meeting ${finalMeetingId}`);

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
          meetingId: finalMeetingId,
          roomName,
          transcripts: finalTranscripts,
          participants: finalParticipants
        })
      });
      
      if (processingResponse.ok) {
        console.log(`✅ MEETING END: Processing triggered successfully for ${finalMeetingId}`);
      } else {
        console.error(`❌ MEETING END: Processing failed to trigger for ${finalMeetingId}:`, processingResponse.status);
      }
    } catch (error) {
      console.error(`❌ MEETING END: Failed to trigger processing for ${finalMeetingId}:`, error);
    }

    // Clean up LiveKit room if it still has participants
    try {
      if (participantCount > 0) {
        console.log(`🧹 MEETING END: Cleaning up ${participantCount} remaining participants from LiveKit room ${roomName}`);
        await liveKitService.disconnectAllParticipants(roomName);
      }
    } catch (error) {
      console.warn(`⚠️ MEETING END: Failed to clean up LiveKit room ${roomName}:`, error);
    }

    console.log(`✅ MEETING END: Background processing started, returning immediately`);

    // Return immediately while processing continues in background
    return NextResponse.json({
      success: true,
      message: 'Meeting ended, processing started in background',
      data: {
        meetingId: finalMeetingId,
        roomName,
        endedAt: meetingEndedAt.toISOString(),
        duration: calculatedDuration,
        transcriptsCount: finalTranscripts.length,
        participantsCount: finalParticipants.length,
        status: 'processing',
        backgroundProcessing: true,
        livekitParticipantsCleared: participantCount
      }
    });

  } catch (error) {
    console.error('❌ MEETING END: Error processing meeting end:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process meeting end',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}