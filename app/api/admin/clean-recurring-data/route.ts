import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

export async function DELETE() {
  try {
    const db = DatabaseService.getInstance();
    
    console.log('Deleting test recurring meeting rooms...');
    
    // Delete recurring rooms and their meetings
    const roomsToDelete = ['daily-standup-recurring', 'project-planning-biweekly'];
    
    for (const roomName of roomsToDelete) {
      const room = await db.getMeetingRoomByName(roomName);
      if (room) {
        // Delete all meetings for this room
        const deletedMeetings = await db.deleteMeetingsByRoom(room._id);
        console.log(`Deleted ${deletedMeetings} meetings for ${roomName}`);
        
        // Delete the room itself
        await db.deleteMeetingRoom(room._id);
        console.log(`Deleted room: ${roomName}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test data cleaned successfully',
      roomsDeleted: roomsToDelete
    });
  } catch (error) {
    console.error('Error cleaning test data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clean test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 