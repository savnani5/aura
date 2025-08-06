import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting abandoned meetings cleanup...');
    
    const db = DatabaseService.getInstance();
    
    // Find meetings that are "active" but haven't had activity in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const abandonedMeetings = await db.findAbandonedMeetings(thirtyMinutesAgo);
    
    console.log(`🔍 Found ${abandonedMeetings.length} potentially abandoned meetings`);
    
    const results = {
      processed: 0,
      completed: 0,
      errors: 0
    };
    
    for (const meeting of abandonedMeetings) {
      try {
        console.log(`📋 Processing abandoned meeting: ${meeting._id} (${meeting.roomName})`);
        console.log(`   Last activity: ${meeting.lastActivity}`);
        console.log(`   Transcripts: ${meeting.transcripts?.length || 0}`);
        
        // Force end the meeting
        await db.atomicMeetingEnd(meeting._id.toString(), {
          transcripts: meeting.transcripts || [],
          participants: meeting.participants || [],
          endedAt: meeting.lastActivity || new Date()
        });
        
        // Trigger processing if there are transcripts
        if (meeting.transcripts && meeting.transcripts.length > 0) {
          console.log(`   🚀 Triggering processing for meeting with ${meeting.transcripts.length} transcripts`);
          
          // Build the processing URL
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';
          
          // Fire-and-forget call to processing endpoint
          fetch(`${baseUrl}/api/process-meeting`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meetingId: meeting._id.toString(),
              roomName: meeting.roomName,
              transcripts: meeting.transcripts,
              participants: meeting.participants || []
            }),
          }).catch(error => {
            console.error(`❌ Failed to trigger processing for ${meeting._id}:`, error);
          });
          
          results.completed++;
        } else {
          console.log(`   ✅ Meeting ended (no transcripts to process)`);
          results.completed++;
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`❌ Error processing meeting ${meeting._id}:`, error);
        results.errors++;
      }
    }
    
    console.log(`🎉 Cleanup completed: ${results.processed} processed, ${results.completed} completed, ${results.errors} errors`);
    
    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.processed} abandoned meetings`
    });
    
  } catch (error) {
    console.error('❌ Error in abandoned meetings cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cleanup abandoned meetings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}