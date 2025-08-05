import { NextRequest, NextResponse } from 'next/server';
import { MeetingProcessor } from '@/lib/services/meeting-processor';
import { DatabaseService } from '@/lib/database/mongodb';

// Dedicated processing function - runs independently
export async function POST(request: NextRequest) {
  try {
    const { meetingId, roomName, transcripts, participants } = await request.json();
    
    console.log(`🚀 DEDICATED PROCESSOR: Starting processing for meeting ${meetingId}`);
    
    const dbService = DatabaseService.getInstance();
    const meeting = await dbService.getMeetingById(meetingId);
    
    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }
    
    // This runs in its own serverless function - no timeout issues
    const processor = MeetingProcessor.getInstance();
    await processor.processImmediately(meetingId, roomName, transcripts, participants);
    
    console.log(`✅ DEDICATED PROCESSOR: Completed processing for meeting ${meetingId}`);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('❌ DEDICATED PROCESSOR: Processing failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export const maxDuration = 60; // 60 seconds for Pro plan, 10s for Free