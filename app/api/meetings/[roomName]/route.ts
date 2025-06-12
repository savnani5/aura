import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// GET /api/meetings/[roomName] - Get specific meeting room with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    const db = DatabaseService.getInstance();
    const meetingRoom = await db.getMeetingRoomByName(roomName);
    
    if (!meetingRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    // Get recent meetings and tasks for this room
    const [recentMeetings, tasks] = await Promise.all([
      db.getMeetingsByRoom(meetingRoom._id, 10), // Last 10 meetings
      db.getTasksByRoom(meetingRoom._id)
    ]);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        ...meetingRoom,
        recentMeetings,
        tasks
      }
    });
  } catch (error) {
    console.error('Error fetching meeting room:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch meeting room' 
    }, { status: 500 });
  }
}

// PUT /api/meetings/[roomName] - Update meeting room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const updates = await request.json();
    
    const db = DatabaseService.getInstance();
    const updatedRoom = await db.updateMeetingRoom(roomName, updates);
    
    if (!updatedRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: updatedRoom 
    });
  } catch (error) {
    console.error('Error updating meeting room:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update meeting room' 
    }, { status: 500 });
  }
}

// DELETE /api/meetings/[roomName] - Delete meeting room (optional)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    // TODO: Implement delete functionality if needed
    // For now, just mark as inactive
    const db = DatabaseService.getInstance();
    const updatedRoom = await db.updateMeetingRoom(roomName, { isActive: false });
    
    if (!updatedRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Meeting room deactivated' 
    });
  } catch (error) {
    console.error('Error deleting meeting room:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete meeting room' 
    }, { status: 500 });
  }
} 