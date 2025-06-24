import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { EmbeddingsService } from '@/lib/embeddings-service';
import { RAGService } from '@/lib/rag-service';

export async function POST() {
  try {
    const dbService = DatabaseService.getInstance();
    const embeddingsService = EmbeddingsService.getInstance();
    const ragService = RAGService.getInstance();
    
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
          console.log(`   ⏩ Skipping meeting ${meeting._id} - no transcripts`);
          continue;
        }
        
        // Check if meeting already has embeddings in the new schema
        if (meeting.hasEmbeddings) {
          console.log(`   ✅ Meeting ${meeting._id} already has embeddings`);
          continue;
        }
        
        console.log(`   🔄 Processing ${meeting.transcripts.length} transcripts for meeting: ${meeting.title || 'Untitled'}`);
        
        try {
          // Store transcripts with embeddings using the RAG service which handles the new schema
          await ragService.storeTranscriptEmbeddings(meeting._id, meeting.transcripts);
          
          totalMeetingsProcessed++;
          totalTranscriptsProcessed += meeting.transcripts.length;
          
          console.log(`   ✅ Generated embeddings for ${meeting.transcripts.length} transcripts`);
          
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
    console.error('Error generating embeddings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 