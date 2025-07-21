import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/participants/[roomName] - Get participants for a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    const db = DatabaseService.getInstance();
    const meetingRoom = await db.getMeetingRoom(roomName);
    
    if (!meetingRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    // Transform participants to include online status
    // For now, we'll mock online status since we don't have real-time presence
    const participants = meetingRoom.participants.map(participant => ({
      id: participant.userId || participant.name.toLowerCase().replace(/\s+/g, '-'),
      name: participant.name,
      email: `${participant.name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      role: participant.role,
      joinedAt: participant.joinedAt,
      isOnline: Math.random() > 0.3, // Mock online status - 70% chance online
      isHost: participant.role === 'host'
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: participants 
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch participants' 
    }, { status: 500 });
  }
} 