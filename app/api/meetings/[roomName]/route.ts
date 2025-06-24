import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { auth } from '@clerk/nextjs/server';

// GET /api/meetings/[roomName] - Get specific meeting room with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const db = DatabaseService.getInstance();
    
    // Get the room by name instead of ID
    const room = await db.getMeetingRoomByName(roomName);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Meeting room not found'
      }, { status: 404 });
    }
    
    // Get recent meetings and tasks for this room
    const [recentMeetings, tasks] = await Promise.all([
      db.getMeetingsByRoom(room._id, 10), // Last 10 meetings
      db.getTasksByRoom(room._id)
    ]);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        ...room,
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

// DELETE /api/meetings/[roomName] - Delete meeting room and all associated data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const db = DatabaseService.getInstance();
    
    // Get user from database
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    // Get the room to check permissions
    const room = await db.getMeetingRoomByName(roomName);
    if (!room) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }
    
    // Check if user is the creator or host
    const isCreator = room.createdBy === user._id;
    const isHost = room.participants.some(p => 
      (p.userId === user._id || p.email === user.email) && p.role === 'host'
    );
    
    if (!isCreator && !isHost) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only hosts or room creators can delete meeting rooms' 
      }, { status: 403 });
    }
    
    // Perform comprehensive deletion
    const deleteResult = await db.deleteMeetingRoom(room._id);
    
    if (!deleteResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete meeting room' 
      }, { status: 500 });
    }
    
    console.log(`🗑️ Meeting room deleted successfully by ${user.name}:`, {
      roomName,
      roomId: room._id,
      deletedCounts: deleteResult.deletedCounts
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Meeting room and all associated data deleted successfully',
      deletedCounts: deleteResult.deletedCounts
    });
  } catch (error) {
    console.error('Error deleting meeting room:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete meeting room' 
    }, { status: 500 });
  }
} 