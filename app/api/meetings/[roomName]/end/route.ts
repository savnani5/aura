import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { MeetingProcessor } from '@/lib/services/meeting-processor';

// Database-based locking for serverless environments (replaces in-memory locks)
      
// POST /api/meetings/[roomName]/end - Handle meeting end with async processing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    // Add debugging for request body
    console.log('📡 MEETING END API: Received request for room:', roomName);
    console.log('📡 MEETING END API: Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('📡 MEETING END API: Request method:', request.method);
    console.log('📡 MEETING END API: Request URL:', request.url);
    
    let requestBody;
    try {
      const bodyText = await request.text();
      console.log('📡 MEETING END API: Raw request body:', bodyText);
      console.log('📡 MEETING END API: Body length:', bodyText.length);
      
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
       action = 'end_meeting', // 'participant_leave' or 'end_meeting'
       participantId,
       transcripts = [],
       participants = [],
       endedAt,
       duration
     } = requestBody;

    // Validate required fields
    if (!meetingId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: meetingId'
      }, { status: 400 });
    }

    // Database-based duplicate prevention (serverless-safe)
    const dbService = DatabaseService.getInstance();
    const meeting = await dbService.getMeetingById(meetingId);
    
    if (!meeting) {
      return NextResponse.json({
        success: false,
        error: 'Meeting not found'
      }, { status: 404 });
    }

    // Check if already processing/ended (database-based lock)
    if (meeting.status === 'ended' || meeting.status === 'completed' || meeting.status === 'processing') {
      return NextResponse.json({
        success: true,
        message: 'Meeting is already being processed or completed',
        data: {
          meetingId,
          roomName,
          status: meeting.status,
          alreadyProcessed: true
        }
      });
    }

    // Verify meeting belongs to this room
    if (meeting.roomName !== roomName) {
      return NextResponse.json({
        success: false,
        error: 'Meeting does not belong to this room'
      }, { status: 400 });
    }

    try {

          // First, handle participant leave to check if we should actually end the meeting
    console.log(`👤 Participant leaving meeting: ${meeting.title || meeting.type} (${meetingId})`);
    console.log(`📊 Current meeting state:`, {
      activeParticipantCount: meeting.activeParticipantCount,
      status: meeting.status
    });

    // Use atomicParticipantLeave to properly track participant count
    const leaveResult = await dbService.atomicParticipantLeave(meetingId);
    
    if (!leaveResult.shouldEndMeeting) {
      console.log(`👥 Participant left, but meeting continues. Active participants: ${leaveResult.meeting?.activeParticipantCount}`);
      return NextResponse.json({
        success: true,
        message: 'Participant left successfully, meeting continues',
        data: {
          meetingId,
          roomName,
          activeParticipantCount: leaveResult.meeting?.activeParticipantCount || 0,
          shouldEndMeeting: false,
          meetingStillActive: true
        }
      });
    }

    console.log(`🔚 Last participant left - ending meeting: ${meeting.title || meeting.type} (${meetingId})`);

    // Calculate end time and duration
    const meetingEndedAt = endedAt ? new Date(endedAt) : new Date();
    const calculatedDuration = duration || Math.round(
      (meetingEndedAt.getTime() - new Date(meeting.startedAt).getTime()) / (1000 * 60)
    );

      // If no transcripts, just delete the empty meeting
      if (!transcripts || transcripts.length === 0) {
        console.log(`🗑️ No transcripts found - deleting empty meeting record: ${meetingId}`);
        await dbService.deleteMeeting(meetingId);
        
        return NextResponse.json({
          success: true,
          message: 'Meeting ended but no content was recorded - meeting record removed',
          data: {
            meetingId: null,
            roomName,
            endedAt: meetingEndedAt.toISOString(),
            duration: calculatedDuration,
            meetingDeleted: true
          }
        });
      }

      // End meeting atomically with transcripts and participants
      const processedParticipants = participants.map((p: any) => ({
        ...p,
        leftAt: p.leftAt ? new Date(p.leftAt) : meetingEndedAt
      }));

      const endedMeeting = await dbService.atomicMeetingEnd(meetingId, {
        transcripts,
        participants: processedParticipants,
        endedAt: meetingEndedAt
      });

      if (!endedMeeting) {
        return NextResponse.json({
          success: false,
          error: 'Failed to end meeting'
        }, { status: 500 });
      }

      console.log(`✅ Meeting ended, starting background processing...`);
          
      // Start processing in background WITHOUT waiting (fire-and-forget)
      console.log(`🔄 MEETING END: Starting async processing for meeting ${meetingId} with ${transcripts.length} transcripts`);
      const processor = MeetingProcessor.getInstance();
      
      // Trigger dedicated processing function (runs in separate serverless instance)
      try {
        const processingResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/process-meeting`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId,
            roomName,
            transcripts,
            participants
          }),
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000) // 5 second timeout for triggering
        });
        
        if (processingResponse.ok) {
          console.log(`✅ MEETING END: Processing function triggered successfully for ${meetingId}`);
        } else {
          console.error(`❌ MEETING END: Processing function failed to trigger for ${meetingId}:`, processingResponse.status);
          // Processing will retry automatically via Vercel's retry mechanism
        }
      } catch (error) {
        console.error(`❌ MEETING END: Failed to trigger processing function for ${meetingId}:`, error);
        // Could implement retry logic here if needed
      }
      
      console.log(`✅ MEETING END: Background processing started, returning immediately`);

      // Return immediately while processing continues in background
      return NextResponse.json({
        success: true,
        message: 'Meeting ended, processing started in background',
        data: {
          meetingId,
          roomName,
          endedAt: meetingEndedAt.toISOString(),
          duration: calculatedDuration,
          transcriptsCount: transcripts.length,
          status: 'processing',
          backgroundProcessing: true
        }
      });

    } catch (error) {
      console.error('Error in meeting end processing:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to process meeting end',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error ending meeting:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to end meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 

