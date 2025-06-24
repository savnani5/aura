import { DatabaseService, IMeeting } from './mongodb';
import { EmbeddingsService } from './embeddings-service';

export interface TranscriptContext {
  speaker: string;
  text: string;
  timestamp: Date;
  meetingId: string;
  meetingType: string;
  similarity?: number;
  meetingDate: Date;
  embedding: number[];
}

export interface RAGContext {
  currentTranscripts: TranscriptContext[];
  historicalContext: TranscriptContext[];
  totalRelevantTranscripts: number;
  usedContext: boolean;
}

export class RAGService {
  private static instance: RAGService;
  private dbService: DatabaseService;
  private embeddingsService: EmbeddingsService;

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.embeddingsService = EmbeddingsService.getInstance();
  }

  static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  /**
   * Detect if query requires comprehensive data or targeted search
   */
  private detectQueryType(query: string): 'comprehensive' | 'targeted' | 'specific' {
    const comprehensiveKeywords = [
      'summarize', 'summary', 'overview', 'all', 'everything', 'comprehensive',
      'recurring', 'frequent', 'patterns', 'trends', 'overall', 'general',
      'action items', 'decisions', 'conclusions', 'outcomes', 'results',
      'discussions', 'topics', 'agenda', 'meetings', 'previous',
      'history', 'past', 'recent', 'lately', 'so far'
    ];

    const queryLower = query.toLowerCase();
    
    // Check for comprehensive keywords
    const hasComprehensiveKeywords = comprehensiveKeywords.some(keyword => 
      queryLower.includes(keyword)
    );

    // Check for question words that typically need broad context
    const hasBroadQuestionWords = /^(what (are|were|have)|how (many|much)|list|show|tell me about)/i.test(query);

    return hasComprehensiveKeywords || hasBroadQuestionWords ? 'comprehensive' : 'targeted';
  }

  /**
   * Get context for query with appropriate retrieval strategy
   */
  async getContextForQuery(
    roomName: string,
    query: string,
    currentTranscripts?: string,
    isLiveMeeting: boolean = false
  ): Promise<RAGContext> {
    try {
      console.log(`🔍 RAG Context Request - Room: ${roomName}, Query: "${query}"`);
      
      const room = await this.dbService.getMeetingRoomByName(roomName);
      if (!room) {
        console.log(`❌ Room not found: ${roomName}`);
        
        // Debug: List all available rooms to see what's in the database
        try {
          const allRooms = await this.dbService.getAllMeetingRooms(10);
          console.log(`🏠 Available rooms in database:`, allRooms.map(r => ({
            roomName: r.roomName,
            title: r.title,
            type: r.type
          })));
        } catch (debugError) {
          console.log(`⚠️ Could not fetch rooms for debugging:`, debugError);
        }
        
        return {
          currentTranscripts: [],
          historicalContext: [],
          totalRelevantTranscripts: 0,
          usedContext: false,
        };
      }

      console.log(`✅ Found room: ${room.title} (${room.roomName})`);

      // Detect query type
      const queryType = this.detectQueryType(query);
      console.log(`🎯 Query type detected: ${queryType}`);

      // Generate embedding for query
      const queryEmbedding = await this.embeddingsService.generateEmbedding(query);

      // Process current transcripts if any
      const currentTranscriptContext: TranscriptContext[] = [];
      if (currentTranscripts && isLiveMeeting) {
        console.log(`🎙️ Processing current transcripts: "${currentTranscripts.substring(0, 100)}..."`);
        const lines = currentTranscripts.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            currentTranscriptContext.push({
              speaker: match[1].trim(),
              text: match[2].trim(),
              timestamp: new Date(),
              meetingId: 'current',
              meetingType: 'Live Meeting',
              meetingDate: new Date(),
              embedding: [],
            });
          }
        }
        console.log(`📝 Processed ${currentTranscriptContext.length} current transcript entries`);
      } else {
        console.log(`🚫 No current transcripts - currentTranscripts: ${!!currentTranscripts}, isLiveMeeting: ${isLiveMeeting}`);
      }

      // Get historical meetings metadata (without transcripts for performance)
      const historicalMeetings = await this.dbService.getMeetingMetadata(room._id, {
        limit: queryType === 'comprehensive' ? 20 : 10,
      });

      console.log(`📚 Found ${historicalMeetings.length} historical meetings for room ${room.title}`);

      // Instead of filtering by hasEmbeddings flag, get all meeting IDs and let 
      // getEmbeddingsByMeeting filter out meetings without embeddings
      const meetingIds = historicalMeetings.map(m => m._id);
      
      console.log(`🔍 Querying embeddings for ${meetingIds.length} meetings`);

      if (meetingIds.length === 0) {
        console.log(`⚠️ No meetings found for room`);
        return {
          currentTranscripts: currentTranscriptContext,
          historicalContext: [],
          totalRelevantTranscripts: currentTranscriptContext.length,
          usedContext: currentTranscriptContext.length > 0,
        };
      }

      // Get embeddings for relevant meetings (this will only return meetings that actually have embeddings)
      const embeddingResults = await this.dbService.getEmbeddingsByMeeting(meetingIds);
      
      console.log(`🔗 Found embeddings for ${embeddingResults.length}/${meetingIds.length} meetings`);

      if (embeddingResults.length === 0) {
        console.log(`⚠️ No meetings have embeddings for RAG context`);
        return {
          currentTranscripts: currentTranscriptContext,
          historicalContext: [],
          totalRelevantTranscripts: currentTranscriptContext.length,
          usedContext: currentTranscriptContext.length > 0,
        };
      }
      
      // Extract all historical transcripts with embeddings
      const allHistoricalTranscripts: TranscriptContext[] = [];
      for (const embeddingResult of embeddingResults) {
        // Convert meetingId to string for comparison since embeddingResult.meetingId is a string
        const meeting = historicalMeetings.find(m => m._id.toString() === embeddingResult.meetingId);
        if (!meeting) {
          console.log(`⚠️ Meeting metadata not found for embedding result: ${embeddingResult.meetingId}`);
          continue;
        }

        console.log(`📝 Meeting "${meeting.title || 'Untitled'}" (${meeting.startedAt.toDateString()}): ${embeddingResult.transcripts.length} transcripts with embeddings`);
        
        for (const transcript of embeddingResult.transcripts) {
          allHistoricalTranscripts.push({
            speaker: transcript.speaker,
            text: transcript.text,
            timestamp: transcript.timestamp,
            meetingId: meeting._id,
            meetingType: meeting.type,
            meetingDate: meeting.startedAt,
            embedding: transcript.embedding,
          });
        }
      }

      console.log(`🔍 Total historical transcripts with embeddings: ${allHistoricalTranscripts.length}`);

      // Rank transcripts by similarity to query
      const rankedTranscripts = allHistoricalTranscripts
        .map(transcript => ({
          ...transcript,
          similarity: this.embeddingsService.calculateCosineSimilarity(
            queryEmbedding.embedding,
            transcript.embedding
          ),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      console.log(`📊 Similarity scores (top 5): ${rankedTranscripts.slice(0, 5).map(t => `${t.similarity.toFixed(3)}`).join(', ')}`);

      // Select top relevant transcripts based on query type
      const relevanceThreshold = queryType === 'specific' ? 0.65 : 0.45;
      const maxTranscripts = queryType === 'comprehensive' ? 15 : 8;

      let historicalContext: TranscriptContext[] = [];

      if (queryType === 'comprehensive') {
        // For comprehensive queries, include more context with lower threshold
        console.log(`🌐 Using comprehensive retrieval strategy`);
        
        // Get more results with a lower threshold for comprehensive coverage
        const relevantHistorical = rankedTranscripts
          .filter(item => item.similarity >= relevanceThreshold)
          .slice(0, maxTranscripts);

        // If we still don't get enough results, include recent transcripts
        if (relevantHistorical.length < 15) {
          console.log(`📈 Comprehensive query needs more context, including recent transcripts`);
          
          // Sort by recency and include recent transcripts even with lower similarity
          const recentTranscripts = rankedTranscripts
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20); // Top 20 most recent

          // Combine similarity-based and recency-based results
          const combinedResults = new Map();
          
          // Add similarity-based results first
          relevantHistorical.forEach(item => {
            combinedResults.set(`${item.meetingId}-${item.timestamp}`, {
              ...item,
              similarity: item.similarity,
            });
          });

          // Add recent results if not already included
          recentTranscripts.forEach(item => {
            const key = `${item.meetingId}-${item.timestamp}`;
            if (!combinedResults.has(key) && combinedResults.size < 25) {
              combinedResults.set(key, item);
            }
          });

          historicalContext = Array.from(combinedResults.values());
        } else {
          historicalContext = relevantHistorical;
        }

      } else {
        // For targeted queries, use higher threshold and fewer results
        console.log(`🎯 Using targeted retrieval strategy`);
        
        const relevantHistorical = rankedTranscripts
          .filter(item => item.similarity >= relevanceThreshold)
          .slice(0, maxTranscripts);

        historicalContext = relevantHistorical;
      }

      console.log(`✅ Retrieved ${historicalContext.length} relevant historical transcripts`);
      console.log(`📋 Current transcript context: ${currentTranscriptContext.length} entries`);
      
      const totalRelevantTranscripts = historicalContext.length + currentTranscriptContext.length;
      const usedContext = historicalContext.length > 0 || currentTranscriptContext.length > 0;
      
      console.log(`🎯 Total relevant transcripts: ${totalRelevantTranscripts}, Used context: ${usedContext}`);
      
      return {
        currentTranscripts: currentTranscriptContext,
        historicalContext,
        totalRelevantTranscripts,
        usedContext,
      };

    } catch (error) {
      console.error('Error getting RAG context:', error);
      return {
        currentTranscripts: [],
        historicalContext: [],
        totalRelevantTranscripts: 0,
        usedContext: false,
      };
    }
  }

  /**
   * Generate embeddings for current transcripts on-demand
   */
  async generateCurrentTranscriptEmbeddings(transcripts: string): Promise<Array<{
    speaker: string;
    text: string;
    embedding: number[];
  }>> {
    try {
      const results: Array<{
        speaker: string;
        text: string;
        embedding: number[];
      }> = [];

      const lines = transcripts.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const speaker = match[1].trim();
          const text = match[2].trim();
          
          const embeddingResult = await this.embeddingsService.generateTranscriptEmbedding(speaker, text);
          
          results.push({
            speaker,
            text,
            embedding: embeddingResult.embedding,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error generating current transcript embeddings:', error);
      return [];
    }
  }

  /**
   * Store transcript embeddings in database after meeting ends
   */
  async storeTranscriptEmbeddings(
    meetingId: string,
    transcripts: Array<{
      speaker: string;
      text: string;
      timestamp: Date;
    }>
  ): Promise<void> {
    try {
      // Validate inputs
      if (!meetingId) {
        throw new Error('Meeting ID is required');
      }
      
      if (!transcripts || transcripts.length === 0) {
        console.log('⚠️ No transcripts provided for embedding generation');
        return;
      }

      // Validate transcript format
      const validTranscripts = transcripts.filter(t => 
        t.speaker && 
        t.text && 
        t.text.trim().length > 0 && 
        t.timestamp instanceof Date
      );

      if (validTranscripts.length === 0) {
        console.log('⚠️ No valid transcripts found for embedding generation');
        return;
      }

      if (validTranscripts.length !== transcripts.length) {
        console.log(`⚠️ Filtered ${transcripts.length} → ${validTranscripts.length} valid transcripts`);
      }

      const meeting = await this.dbService.getMeetingById(meetingId);
      if (!meeting) {
        throw new Error(`Meeting not found: ${meetingId}`);
      }

      console.log(`🔗 Generating embeddings for ${validTranscripts.length} transcripts in meeting: ${meeting.title || 'Untitled'}`);

      // Generate embeddings for all transcripts
      const transcriptTexts = validTranscripts.map(t => `${t.speaker}: ${t.text}`);
      const embeddings = await this.embeddingsService.generateEmbeddings(transcriptTexts);

      if (embeddings.length !== validTranscripts.length) {
        throw new Error(`Embeddings count mismatch: expected ${validTranscripts.length}, got ${embeddings.length}`);
      }

      // Prepare transcripts with embeddings for the new schema
      const transcriptsWithEmbeddings = validTranscripts.map((transcript, index) => ({
        transcriptIndex: index,
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp,
        embedding: embeddings[index]?.embedding || [],
      }));

      // Validate embeddings were generated
      const invalidEmbeddings = transcriptsWithEmbeddings.filter(t => !t.embedding || t.embedding.length === 0);
      if (invalidEmbeddings.length > 0) {
        throw new Error(`${invalidEmbeddings.length} transcripts failed to generate embeddings`);
      }

      // Store embeddings in the separate TranscriptEmbedding collection
      // This method handles deletion of existing embeddings to prevent duplicates
      await this.dbService.storeEmbeddings(meetingId, transcriptsWithEmbeddings);

      // Update meeting with transcripts (without embeddings) and metadata flags
      const updateData: any = {
        transcripts: validTranscripts.map(transcript => ({
          speaker: transcript.speaker,
          text: transcript.text,
          timestamp: transcript.timestamp,
          // No embedding field here anymore - stored separately
        })),
        hasEmbeddings: true,
        transcriptCount: validTranscripts.length,
        // Add timestamp of when embeddings were last generated
        embeddingsGeneratedAt: new Date(),
      };

      await this.dbService.updateMeeting(meetingId, updateData);

      console.log(`✅ Successfully stored ${transcriptsWithEmbeddings.length} transcripts with embeddings for meeting ${meetingId}`);
      
    } catch (error) {
      console.error(`❌ Error storing transcript embeddings for meeting ${meetingId}:`, error);
      
      // Update meeting to mark embedding generation failed
      try {
        await this.dbService.updateMeeting(meetingId, {
          hasEmbeddings: false,
          transcriptCount: 0,
          embeddingError: error instanceof Error ? error.message : 'Unknown error',
          embeddingErrorAt: new Date(),
        });
      } catch (updateError) {
        console.error('Failed to update meeting with embedding error:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Format context for AI prompt
   */
  formatContextForPrompt(context: RAGContext): string {
    let prompt = '';

    if (context.currentTranscripts.length > 0) {
      prompt += 'CURRENT MEETING TRANSCRIPTS:\n';
      context.currentTranscripts.forEach(transcript => {
        prompt += `${transcript.speaker}: ${transcript.text}\n`;
      });
      prompt += '\n';
    }

    if (context.historicalContext.length > 0) {
      prompt += 'RELEVANT HISTORICAL CONTEXT:\n';
      context.historicalContext.forEach(transcript => {
        const meetingInfo = transcript.meetingType;
        const similarity = transcript.similarity ? ` (${Math.round(transcript.similarity * 100)}% relevant)` : '';
        prompt += `[${meetingInfo}${similarity}] ${transcript.speaker}: ${transcript.text}\n`;
      });
      prompt += '\n';
    }

    return prompt;
  }

  /**
   * Get room statistics for context
   */
  async getRoomStats(roomName: string): Promise<{
    totalMeetings: number;
    totalTranscripts: number;
    recentMeetingTypes: string[];
    frequentParticipants: string[];
  }> {
    try {
      const room = await this.dbService.getMeetingRoomByName(roomName);
      if (!room) {
        return {
          totalMeetings: 0,
          totalTranscripts: 0,
          recentMeetingTypes: [],
          frequentParticipants: [],
        };
      }

      // Only get meetings that have transcripts (content that matters for context)
      const meetings = await this.dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: 20,
      });

      // Filter meetings to only include those with actual transcript content
      const meetingsWithContent = meetings.filter(meeting => 
        meeting.transcripts && meeting.transcripts.length > 0
      );

      const totalTranscripts = meetingsWithContent.reduce((sum, meeting) => 
        sum + (meeting.transcripts?.length || 0), 0
      );

      const meetingTypes = [...new Set(meetingsWithContent.map(m => m.type))];
      
      const participantCounts: Record<string, number> = {};
      meetingsWithContent.forEach(meeting => {
        meeting.participants.forEach(participant => {
          participantCounts[participant.name] = (participantCounts[participant.name] || 0) + 1;
        });
      });

      const frequentParticipants = Object.entries(participantCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);

      return {
        totalMeetings: meetingsWithContent.length, // Only count meetings with actual content
        totalTranscripts,
        recentMeetingTypes: meetingTypes,
        frequentParticipants,
      };
    } catch (error) {
      console.error('Error getting room stats:', error);
      return {
        totalMeetings: 0,
        totalTranscripts: 0,
        recentMeetingTypes: [],
        frequentParticipants: [],
      };
    }
  }
} 