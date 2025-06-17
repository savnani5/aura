import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { EmbeddingsService } from '@/lib/embeddings-service';

export async function POST() {
  try {
    const dbService = DatabaseService.getInstance();
    const embeddingsService = EmbeddingsService.getInstance();
    
    console.log('🔍 Finding meetings without embeddings...');
    
    // Get all meeting rooms
    const rooms = await dbService.getAllMeetingRooms();
    
    let totalMeetingsProcessed = 0;
    let totalTranscriptsProcessed = 0;
    
    for (const room of rooms) {
      console.log(`\n📁 Processing room: ${room.title} (${room.roomName})`);
      
      // Get all meetings for this room
      const meetings = await dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: 100
      });
      
      console.log(`   📄 Found ${meetings.length} meetings`);
      
      for (const meeting of meetings) {
        if (!meeting.transcripts || meeting.transcripts.length === 0) {
          continue;
        }
        
        // Check if transcripts already have embeddings
        const transcriptsNeedingEmbeddings = meeting.transcripts.filter(
          transcript => !transcript.embedding || transcript.embedding.length === 0
        );
        
        if (transcriptsNeedingEmbeddings.length === 0) {
          continue;
        }
        
        console.log(`   🔄 Processing ${transcriptsNeedingEmbeddings.length} transcripts for meeting: ${meeting.title || 'Untitled'}`);
        
        // Generate embeddings for transcripts that need them
        const transcriptTexts = transcriptsNeedingEmbeddings.map(
          t => `${t.speaker}: ${t.text}`
        );
        
        try {
          const embeddings = await embeddingsService.generateEmbeddings(transcriptTexts);
          
          // Update the meeting with embeddings
          const updatedTranscripts = meeting.transcripts.map(transcript => {
            const needsEmbedding = transcriptsNeedingEmbeddings.find(
              t => t.speaker === transcript.speaker && 
                   t.text === transcript.text && 
                   t.timestamp.getTime() === transcript.timestamp.getTime()
            );
            
            if (needsEmbedding) {
              const embeddingIndex = transcriptsNeedingEmbeddings.indexOf(needsEmbedding);
              return {
                ...transcript,
                embedding: embeddings[embeddingIndex]?.embedding || []
              };
            }
            
            return transcript;
          });
          
          // Save updated meeting
          await dbService.updateMeeting(meeting._id, {
            transcripts: updatedTranscripts
          });
          
          totalMeetingsProcessed++;
          totalTranscriptsProcessed += transcriptsNeedingEmbeddings.length;
          
          console.log(`   ✅ Generated embeddings for ${transcriptsNeedingEmbeddings.length} transcripts`);
          
        } catch (embeddingError) {
          console.error(`   ❌ Error generating embeddings for meeting ${meeting._id}:`, embeddingError);
        }
      }
    }
    
    console.log(`\n🎉 Embedding generation complete!`);
    console.log(`   📊 Meetings processed: ${totalMeetingsProcessed}`);
    console.log(`   📊 Transcripts processed: ${totalTranscriptsProcessed}`);
    
    return NextResponse.json({
      success: true,
      message: 'Embeddings generated successfully',
      stats: {
        roomsProcessed: rooms.length,
        meetingsProcessed: totalMeetingsProcessed,
        transcriptsProcessed: totalTranscriptsProcessed
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 