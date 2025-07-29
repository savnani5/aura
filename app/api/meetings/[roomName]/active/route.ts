import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/meetings/[roomName]/active - Check if there's an active meeting in the room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const dbService = DatabaseService.getInstance();
    
    // Get the meeting room first
    const room = await dbService.getMeetingRoomByName(roomName);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Meeting room not found'
      }, { status: 404 });
    }
    
    // Check for active meeting
    const activeMeeting = await dbService.getActiveMeetingByRoom(roomName);
    
    if (activeMeeting) {
      return NextResponse.json({
        success: true,
        data: {
          hasActiveMeeting: true,
          meeting: {
            id: activeMeeting._id,
            title: activeMeeting.title || activeMeeting.type,
            type: activeMeeting.type,
            startedAt: activeMeeting.startedAt.toISOString(),
            participantCount: activeMeeting.participants?.length || 0,
            duration: Math.round((new Date().getTime() - new Date(activeMeeting.startedAt).getTime()) / (1000 * 60)) // minutes
          }
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        data: {
          hasActiveMeeting: false,
          meeting: null
        }
      });
    }
    
  } catch (error) {
    console.error('Error checking active meeting:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check active meeting'
    }, { status: 500 });
  }
} 