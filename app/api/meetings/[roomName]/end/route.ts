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
      if (meeting.endedAt) {
        console.log(`⚠️ Meeting ${meetingId} already ended at ${meeting.endedAt}`);
        return NextResponse.json({
          success: true,
          message: 'Meeting was already ended successfully',
          data: {
            meetingId: meeting._id,
            roomName: meeting.roomName,
            endedAt: meeting.endedAt.toISOString(),
            duration: meeting.duration || 0,
            alreadyEnded: true,
            redirectUrl: meeting.roomId ? `/meetingroom/${roomName}` : '/'
          }
        });
      }

      console.log(`🔚 Ending meeting: ${meeting.title || meeting.type} (${meetingId})`);

      // Calculate end time and duration
      const meetingEndedAt = endedAt ? new Date(endedAt) : new Date();
      const calculatedDuration = duration || Math.round(
        (meetingEndedAt.getTime() - new Date(meeting.startedAt).getTime()) / (1000 * 60)
      );

      // Update meeting with basic end data first
      const updateData: any = {
        endedAt: meetingEndedAt,
        duration: calculatedDuration
      };

      if (participants.length > 0) {
        updateData.participants = participants.map((p: any) => ({
          ...p,
          leftAt: p.leftAt ? new Date(p.leftAt) : meetingEndedAt
        }));
      }

      // If no transcripts, just end the meeting and delete it
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
              meetingDeleted: true,
            redirectUrl: meeting.roomId ? `/meetingroom/${roomName}` : '/'
            }
          });
      }

      // Update meeting with end data
      await dbService.updateMeeting(meetingId, updateData);
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
          processing: processingResult,
          redirectUrl: meeting.roomId ? `/meetingroom/${roomName}` : '/'
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