import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { MeetingProcessor } from '@/lib/services/meeting-processor';

// Simple in-memory lock to prevent duplicate meeting end requests
const meetingEndLocks = new Set<string>();
      
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

    // Prevent duplicate processing
    if (meetingEndLocks.has(meetingId)) {
      return NextResponse.json({
        success: true,
        message: 'Meeting is already being processed',
        data: {
          meetingId,
          roomName,
          alreadyProcessing: true
        }
      });
    }

    meetingEndLocks.add(meetingId);

    try {
      const dbService = DatabaseService.getInstance();

      // Get the meeting to verify it exists
      const meeting = await dbService.getMeetingById(meetingId);
      if (!meeting) {
        return NextResponse.json({
          success: false,
          error: 'Meeting not found'
        }, { status: 404 });
      }

      if (meeting.roomName !== roomName) {
        return NextResponse.json({
          success: false,
          error: 'Meeting does not belong to this room'
        }, { status: 400 });
      }

          // Check if meeting is already ended
    if (meeting.status === 'ended' || meeting.status === 'completed' || meeting.endedAt) {
      console.log(`⚠️ Meeting ${meetingId} already ended`);
      return NextResponse.json({
        success: true,
        message: 'Meeting was already ended successfully',
        data: {
          meetingId: meeting._id,
          roomName: meeting.roomName,
          status: meeting.status,
          alreadyEnded: true
        }
      });
    }

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
          
      // Process immediately within Vercel function limits
      console.log(`🔄 MEETING END: Starting processing for meeting ${meetingId} with ${transcripts.length} transcripts`);
      const processor = MeetingProcessor.getInstance();
      const processingResult = await processor.processImmediately(
        meetingId,
        roomName,
        transcripts,
              participants
            );
      
      console.log(`✅ MEETING END: Processing result:`, processingResult);

      // Return with processing results
      return NextResponse.json({
        success: true,
        message: 'Meeting ended and processed successfully',
        data: {
          meetingId,
          roomName,
          endedAt: meetingEndedAt.toISOString(),
          duration: calculatedDuration,
          transcriptsCount: transcripts.length,
          status: 'processing',
          processing: processingResult
        }
      });

    } finally {
      // Clean up lock after a delay to prevent immediate duplicates
      setTimeout(() => {
        meetingEndLocks.delete(meetingId);
      }, 5000);
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

