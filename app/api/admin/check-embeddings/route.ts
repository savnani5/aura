import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

export async function POST() {
  try {
    const dbService = DatabaseService.getInstance();
    
    console.log('🔍 Checking embeddings in database...');
    
    // Get project planning room
    const room = await dbService.getMeetingRoomByName('project-planning-biweekly');
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Project planning room not found'
      }, { status: 404 });
    }
    
    console.log(`📁 Found room: ${room.title} (ID: ${room._id})`);
    
    // Get meetings for this room
    const meetings = await dbService.getMeetingsByRoomWithFilters({
      roomId: room._id,
      limit: 10
    });
    
    console.log(`📄 Found ${meetings.length} meetings`);
    
    let totalTranscripts = 0;
    let transcriptsWithEmbeddings = 0;
    const sampleTranscripts: any[] = [];
    
    for (const meeting of meetings) {
      if (meeting.transcripts && meeting.transcripts.length > 0) {
        for (const transcript of meeting.transcripts) {
          totalTranscripts++;
          
          if (transcript.embedding && transcript.embedding.length > 0) {
            transcriptsWithEmbeddings++;
            
            // Collect first 3 sample transcripts for inspection
            if (sampleTranscripts.length < 3) {
              sampleTranscripts.push({
                speaker: transcript.speaker,
                text: transcript.text.substring(0, 100) + '...',
                embeddingLength: transcript.embedding.length,
                hasEmbedding: true
              });
            }
          } else {
            // Collect sample without embedding
            if (sampleTranscripts.length < 3) {
              sampleTranscripts.push({
                speaker: transcript.speaker,
                text: transcript.text.substring(0, 100) + '...',
                embeddingLength: 0,
                hasEmbedding: false
              });
            }
          }
        }
      }
    }
    
    console.log(`📊 Total transcripts: ${totalTranscripts}`);
    console.log(`🔗 Transcripts with embeddings: ${transcriptsWithEmbeddings}`);
    
    return NextResponse.json({
      success: true,
      room: {
        name: room.roomName,
        title: room.title,
        id: room._id
      },
      stats: {
        totalMeetings: meetings.length,
        totalTranscripts,
        transcriptsWithEmbeddings,
        embeddingCoverage: totalTranscripts > 0 ? (transcriptsWithEmbeddings / totalTranscripts * 100).toFixed(1) + '%' : '0%'
      },
      sampleTranscripts
    });
    
  } catch (error) {
    console.error('❌ Error checking embeddings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 