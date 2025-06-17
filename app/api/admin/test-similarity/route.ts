import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { EmbeddingsService } from '@/lib/embeddings-service';

export async function POST(request: NextRequest) {
  try {
    const { query = "project timeline" } = await request.json();
    
    const dbService = DatabaseService.getInstance();
    const embeddingsService = EmbeddingsService.getInstance();
    
    console.log(`🔍 Testing similarity for query: "${query}"`);
    
    // Get project planning room
    const room = await dbService.getMeetingRoomByName('project-planning-biweekly');
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Project planning room not found'
      }, { status: 404 });
    }
    
    // Generate embedding for the query
    const queryEmbedding = await embeddingsService.generateEmbedding(query);
    console.log(`📊 Query embedding generated: ${queryEmbedding.embedding.length} dimensions`);
    
    // Get meetings for this room
    const meetings = await dbService.getMeetingsByRoomWithFilters({
      roomId: room._id,
      limit: 5
    });
    
    console.log(`📄 Found ${meetings.length} meetings`);
    
    // Extract all transcripts with embeddings
    const historicalTranscripts: Array<{
      embedding: number[];
      metadata: {
        speaker: string;
        text: string;
        meetingTitle?: string;
        meetingType: string;
      };
    }> = [];
    
    for (const meeting of meetings) {
      if (meeting.transcripts && meeting.transcripts.length > 0) {
        for (const transcript of meeting.transcripts) {
          if (transcript.embedding && transcript.embedding.length > 0) {
            historicalTranscripts.push({
              embedding: transcript.embedding,
              metadata: {
                speaker: transcript.speaker,
                text: transcript.text,
                meetingTitle: meeting.title,
                meetingType: meeting.type,
              },
            });
          }
        }
      }
    }
    
    console.log(`📋 Found ${historicalTranscripts.length} transcripts with embeddings`);
    
    // Test different thresholds
    const thresholds = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const results: any = {};
    
    for (const threshold of thresholds) {
      const similarResults = embeddingsService.findMostSimilar(
        queryEmbedding.embedding,
        historicalTranscripts,
        10, // Top 10
        threshold
      );
      
      results[`threshold_${threshold}`] = {
        count: similarResults.length,
        topResults: similarResults.slice(0, 3).map(result => ({
          similarity: Math.round(result.similarity * 1000) / 1000,
          speaker: result.metadata.speaker,
          text: result.metadata.text.substring(0, 150) + '...',
          meetingType: result.metadata.meetingType
        }))
      };
      
      console.log(`📊 Threshold ${threshold}: ${similarResults.length} results`);
    }
    
    // Also calculate similarity for a few sample transcripts manually
    const sampleSimilarities = historicalTranscripts.slice(0, 5).map(transcript => ({
      similarity: embeddingsService.calculateCosineSimilarity(queryEmbedding.embedding, transcript.embedding),
      speaker: transcript.metadata.speaker,
      text: transcript.metadata.text.substring(0, 100) + '...',
    }));
    
    return NextResponse.json({
      success: true,
      query,
      queryEmbeddingLength: queryEmbedding.embedding.length,
      totalTranscripts: historicalTranscripts.length,
      results,
      sampleSimilarities: sampleSimilarities.sort((a, b) => b.similarity - a.similarity)
    });
    
  } catch (error) {
    console.error('❌ Error testing similarity:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test similarity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 