import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

// Simple in-memory participant tracking for each meeting
const meetingParticipants = new Map<string, Set<string>>();

// POST /api/meetings/[roomName]/participants - Track participant join/leave
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const body = await request.json();
    const { 
      meetingId,
      participantId,
      participantName,
      action, // 'join' or 'leave'
      timestamp 
    } = body;

    // Validate required fields
    if (!meetingId || !participantId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: meetingId, participantId, action'
      }, { status: 400 });
    }

    const dbService = DatabaseService.getInstance();
    
    // Get or create participant set for this meeting
    if (!meetingParticipants.has(meetingId)) {
      meetingParticipants.set(meetingId, new Set());
    }
    
    const participants = meetingParticipants.get(meetingId)!;
    
    // Handle participant action
    if (action === 'join') {
      participants.add(participantId);
      console.log(`👥 PARTICIPANT TRACKER: ${participantName} (${participantId}) joined meeting ${meetingId}`);
      console.log(`👥 PARTICIPANT TRACKER: Total participants now: ${participants.size}`);
    } else if (action === 'leave') {
      participants.delete(participantId);
      console.log(`👥 PARTICIPANT TRACKER: ${participantName} (${participantId}) left meeting ${meetingId}`);
      console.log(`👥 PARTICIPANT TRACKER: Total participants now: ${participants.size}`);
      
      // If no participants remain, clean up and signal meeting should end
      if (participants.size === 0) {
        console.log(`🔚 PARTICIPANT TRACKER: Last participant left meeting ${meetingId} - meeting should end`);
        meetingParticipants.delete(meetingId);
      }
    }

    // Return current participant status
    return NextResponse.json({
      success: true,
      data: {
        meetingId,
        totalParticipants: participants.size,
        activeParticipants: Array.from(participants),
        shouldEndMeeting: participants.size === 0,
        action: action,
        participantId,
        participantName,
        timestamp: timestamp || new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error tracking participant:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to track participant'
    }, { status: 500 });
  }
}

// GET /api/meetings/[roomName]/participants - Get current participants
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({
        success: false,
        error: 'Meeting ID required'
      }, { status: 400 });
    }

    const participants = meetingParticipants.get(meetingId) || new Set();
    
    return NextResponse.json({
      success: true,
      data: {
        meetingId,
        totalParticipants: participants.size,
        activeParticipants: Array.from(participants),
        isActive: participants.size > 0
      }
    });

  } catch (error) {
    console.error('Error getting participants:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get participants'
    }, { status: 500 });
  }
} 