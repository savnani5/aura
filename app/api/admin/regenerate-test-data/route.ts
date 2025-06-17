import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

export async function POST() {
  try {
    const db = DatabaseService.getInstance();
    
    console.log('🗑️ Clearing existing test data...');
    
    // Find existing test rooms
    const projectRoom = await db.getMeetingRoomByName('project-planning-biweekly');
    const standupRoom = await db.getMeetingRoomByName('daily-standup-recurring');
    
    // Clear existing meetings for these rooms
    if (projectRoom) {
      const deletedCount = await db.deleteMeetingsByRoom(projectRoom._id);
      console.log(`   🗑️ Deleted ${deletedCount} project planning meetings`);
    }
    
    if (standupRoom) {
      const deletedCount = await db.deleteMeetingsByRoom(standupRoom._id);
      console.log(`   🗑️ Deleted ${deletedCount} standup meetings`);
    }
    
    console.log('🚀 Regenerating meetings with transcripts...');
    
    let totalMeetings = 0;
    
    // Regenerate project planning meetings if room exists
    if (projectRoom) {
      console.log('   📅 Generating Project Planning meetings...');
      const projectMeetings = await db.generateRecurringMeetingHistory(projectRoom._id, 6);
      totalMeetings += projectMeetings.length;
      console.log(`   ✅ Generated ${projectMeetings.length} project planning meetings`);
    }
    
    // Regenerate standup meetings if room exists
    if (standupRoom) {
      console.log('   📅 Generating Daily Standup meetings...');
      const standupMeetings = await db.generateRecurringMeetingHistory(standupRoom._id, 8);
      totalMeetings += standupMeetings.length;
      console.log(`   ✅ Generated ${standupMeetings.length} standup meetings`);
    }
    
    if (!projectRoom && !standupRoom) {
      return NextResponse.json({
        success: false,
        error: 'No test rooms found. Please run the generate-recurring-data endpoint first.'
      }, { status: 404 });
    }
    
    console.log(`🎉 Regeneration complete! Total meetings: ${totalMeetings}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test data regenerated successfully with transcripts',
      data: {
        meetingsGenerated: totalMeetings,
        roomsProcessed: [projectRoom, standupRoom].filter(Boolean).length,
        rooms: [
          projectRoom ? {
            roomName: projectRoom.roomName,
            title: projectRoom.title,
            pattern: 'Biweekly, Fridays 2:00 PM'
          } : null,
          standupRoom ? {
            roomName: standupRoom.roomName,
            title: standupRoom.title,
            pattern: 'Weekly, Mondays 9:00 AM'
          } : null
        ].filter(Boolean)
      }
    });
    
  } catch (error) {
    console.error('❌ Error regenerating test data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to regenerate test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 