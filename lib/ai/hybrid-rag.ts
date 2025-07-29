import { DatabaseService, IMeeting } from '../database/mongodb';
import { EmbeddingsService } from './embeddings';
import { PineconeService, PineconeQueryResult } from './pinecone';

export interface TranscriptContext {
  speaker: string;
  text: string;
  timestamp: Date;
  meetingId: string;
  meetingType: string;
  similarity?: number;
  meetingDate: Date;
  embedding?: number[];
}

export interface RAGContext {
  currentTranscripts: TranscriptContext[];
  historicalContext: TranscriptContext[];
  totalRelevantTranscripts: number;
  usedContext: boolean;
}

export class HybridRAGService {
  private static instance: HybridRAGService;
  private dbService: DatabaseService;
  private embeddingsService: EmbeddingsService;
  private pineconeService: PineconeService;

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.embeddingsService = EmbeddingsService.getInstance();
    this.pineconeService = PineconeService.getInstance();
  }

  static getInstance(): HybridRAGService {
    if (!HybridRAGService.instance) {
      HybridRAGService.instance = new HybridRAGService();
    }
    return HybridRAGService.instance;
  }

  /**
   * Initialize the hybrid RAG service
   */
  async initialize(): Promise<void> {
    try {
      await this.pineconeService.initializeIndex();
      console.log('✅ Hybrid RAG service initialized');
    } catch (error) {
      console.error('❌ Error initializing hybrid RAG service:', error);
      throw error;
    }
  }

  /**
   * Get context for query using hybrid approach: MongoDB metadata + Pinecone vectors
   */
  async getContextForQuery(
    roomName: string,
    query: string,
    currentTranscripts?: string,
    isLiveMeeting: boolean = false
  ): Promise<RAGContext> {
    try {
      console.log(`🔍 Hybrid RAG Context Request - Room: ${roomName}, Query: "${query}"`);
      
      const room = await this.dbService.getMeetingRoomByName(roomName);
      if (!room) {
        console.log(`❌ Room not found: ${roomName}`);
        return {
          currentTranscripts: [],
          historicalContext: [],
          totalRelevantTranscripts: 0,
          usedContext: false,
        };
      }

      console.log(`✅ Found room: ${room.title} (${room.roomName})`);
      console.log(`🔒 Search scope: LIMITED to room ${room.roomName} only`);

      // Detect query type for comprehensive vs targeted search
      const queryType = this.detectQueryType(query);
      console.log(`🎯 Query type: ${queryType}`);

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
            });
          }
        }
        console.log(`📝 Processed ${currentTranscriptContext.length} current transcript entries`);
      }

      // Get historical context using Pinecone + MongoDB hybrid approach
      const historicalContext = await this.getHybridHistoricalContext(
        room._id,
        queryEmbedding.embedding,
        queryType
      );

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
      console.error('Error getting hybrid RAG context:', error);
      return {
        currentTranscripts: [],
        historicalContext: [],
        totalRelevantTranscripts: 0,
        usedContext: false,
      };
    }
  }

  /**
   * Get historical context using hybrid approach: Pinecone for similarity + MongoDB for metadata
   */
  private async getHybridHistoricalContext(
    roomId: string,
    queryEmbedding: number[],
    queryType: 'comprehensive' | 'targeted' | 'specific'
  ): Promise<TranscriptContext[]> {
    try {
      // Step 1: Query Pinecone for semantically similar transcripts (optimized for speed)
      const topK = queryType === 'comprehensive' ? 20 : 15;  // Reduced from 30/20 to 20/15
      const threshold = queryType === 'comprehensive' ? 0.3 : 0.4;  // Lowered thresholds for better retrieval
      
      console.log(`🔍 Querying Pinecone with topK=${topK}, threshold=${threshold}, roomId=${roomId}`);
      const pineconeResults = await this.pineconeService.queryTranscripts(
        queryEmbedding,
        roomId,
        topK,
        threshold
      );
      console.log(`🔍 Pinecone initial query returned ${pineconeResults.length} results`);

      if (pineconeResults.length === 0) {
        console.log('⚠️ No relevant transcripts found in Pinecone, trying with lower threshold');
        
        // Fallback: Try with a much lower threshold to get some results
        const fallbackThreshold = 0.2;
        const fallbackResults = await this.pineconeService.queryTranscripts(
          queryEmbedding,
          roomId,
          Math.min(topK, 10), // Limit to 10 results for fallback
          fallbackThreshold
        );
        
        if (fallbackResults.length === 0) {
          console.log('⚠️ No transcripts found even with fallback threshold');
          return [];
        }
        
        console.log(`📋 Found ${fallbackResults.length} transcripts with fallback threshold ${fallbackThreshold}`);
        // Use fallback results
        pineconeResults.push(...fallbackResults);
      }

      // Step 2: Get meeting metadata from MongoDB for enriched context
      const meetingIds = [...new Set(pineconeResults.map(r => r.metadata.meetingId))];
      const meetings = await this.dbService.getMeetingsByIds(meetingIds);
      
      // Create a lookup map for meeting metadata
      const meetingMap = new Map<string, IMeeting>();
      meetings.forEach(meeting => {
        meetingMap.set(meeting._id, meeting);
      });

      // Step 3: Combine Pinecone results with MongoDB metadata
      const historicalContext: TranscriptContext[] = [];
      
      // Add meeting summaries first (high relevance)
      for (const meeting of meetings) {
        if (meeting.summary && meeting.summary.content) {
          historicalContext.push({
            speaker: 'AI Summary',
            text: `Meeting Summary: ${meeting.summary.content}`,
            timestamp: meeting.startedAt,
            meetingId: meeting._id,
            meetingType: `${meeting.type} (All participants: ${meeting.participants?.map(p => p.name).join(', ') || 'Unknown'})`,
            meetingDate: meeting.startedAt,
            similarity: 0.85 // High relevance for summaries
          });
        }
      }

      // Add transcript results from Pinecone
      for (const result of pineconeResults) {
        const meeting = meetingMap.get(result.metadata.meetingId);
        if (meeting) {
          historicalContext.push({
            speaker: result.metadata.speaker,
            text: result.metadata.text,
            timestamp: new Date(result.metadata.timestamp),
            meetingId: result.metadata.meetingId,
            meetingType: `${meeting.type} (All participants: ${meeting.participants?.map(p => p.name).join(', ') || 'Unknown'})`,
            meetingDate: new Date(result.metadata.meetingDate),
            similarity: result.score
          });
        }
      }

      // Sort by relevance and recency, prioritizing summaries
      historicalContext.sort((a, b) => {
        // Prioritize summaries first
        if (a.speaker === 'AI Summary' && b.speaker !== 'AI Summary') return -1;
        if (b.speaker === 'AI Summary' && a.speaker !== 'AI Summary') return 1;
        
        // Then by similarity/relevance
        const aSimilarity = a.similarity || 0;
        const bSimilarity = b.similarity || 0;
        if (Math.abs(aSimilarity - bSimilarity) > 0.1) {
          return bSimilarity - aSimilarity;
        }
        
        // Finally by recency
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Limit results based on query type
      const maxResults = queryType === 'comprehensive' ? 25 : 15;
      return historicalContext.slice(0, maxResults);

    } catch (error) {
      console.error('Error getting hybrid historical context:', error);
      return [];
    }
  }

  /**
   * Detect query type for appropriate retrieval strategy
   */
  private detectQueryType(query: string): 'comprehensive' | 'targeted' | 'specific' {
    const comprehensiveKeywords = [
      'summary', 'overview', 'what happened', 'tell me about', 'explain',
      'context', 'background', 'history', 'all about', 'everything'
    ];
    
    const specificKeywords = [
      'when did', 'who said', 'what time', 'specific', 'exact', 'particular',
      'find', 'search', 'locate', 'show me'
    ];

    const queryLower = query.toLowerCase();
    
    if (comprehensiveKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'comprehensive';
    }
    
    if (specificKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'specific';
    }
    
    return 'targeted';
  }

  /**
   * Retrieve transcripts for a meeting from Pinecone
   */
  async getTranscriptsForMeeting(meetingId: string): Promise<Array<{
    speaker: string;
    text: string;
    timestamp: Date;
    transcriptIndex: number;
  }>> {
    try {
      return await this.pineconeService.getTranscriptsByMeeting(meetingId);
    } catch (error) {
      console.error('❌ Error retrieving transcripts:', error);
      throw error;
    }
  }

  /**
   * Store transcript embeddings in Pinecone only (no MongoDB duplication)
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
      if (!meetingId || !transcripts || transcripts.length === 0) {
        console.log('⚠️ No valid transcripts provided for embedding generation');
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

      // Prepare transcripts with embeddings
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

      // Store in Pinecone (for fast semantic search)
      await this.pineconeService.storeTranscriptEmbeddings(
        meetingId,
        meeting.roomId,
        meeting.type,
        meeting.startedAt,
        transcriptsWithEmbeddings
      );

      // Update meeting metadata
      await this.dbService.updateMeeting(meetingId, {
        transcripts: validTranscripts.map(transcript => ({
          speaker: transcript.speaker,
          text: transcript.text,
          timestamp: transcript.timestamp,
        })),
        hasEmbeddings: true,
        transcriptCount: validTranscripts.length,
        embeddingsGeneratedAt: new Date(),
      });

      console.log(`✅ Successfully stored ${transcriptsWithEmbeddings.length} transcripts with embeddings in both MongoDB and Pinecone`);
      
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
   * Get room statistics for AI context
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

      const meetings = await this.dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: 50,
        includeTranscripts: false
      });

      const totalMeetings = meetings.length;
      const totalTranscripts = meetings.reduce((sum, meeting) => sum + (meeting.transcriptCount || 0), 0);
      
      // Get recent meeting types
      const recentMeetingTypes = [...new Set(meetings.slice(0, 10).map(m => m.type))];
      
      // Get frequent participants
      const participantCounts = new Map<string, number>();
      meetings.forEach(meeting => {
        meeting.participants?.forEach(participant => {
          const count = participantCounts.get(participant.name) || 0;
          participantCounts.set(participant.name, count + 1);
        });
      });
      
      const frequentParticipants = Array.from(participantCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      return {
        totalMeetings,
        totalTranscripts,
        recentMeetingTypes,
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

  /**
   * Format context for AI prompt
   */
  formatContextForPrompt(context: RAGContext): string {
    let prompt = '';

    if (context.currentTranscripts.length > 0) {
      prompt += 'CURRENT MEETING TRANSCRIPTS:\n';
      prompt += '(This is what was just said in the live meeting)\n';
      context.currentTranscripts.forEach(transcript => {
        prompt += `${transcript.speaker}: ${transcript.text}\n`;
      });
      prompt += '\n';
    }

    if (context.historicalContext.length > 0) {
      prompt += 'RELEVANT HISTORICAL CONTEXT:\n';
      prompt += '(These are relevant excerpts from past meetings in this room)\n';
      
      // Group by meeting for better context
      const transcriptsByMeeting = new Map<string, TranscriptContext[]>();
      context.historicalContext.forEach(transcript => {
        const key = transcript.meetingId;
        if (!transcriptsByMeeting.has(key)) {
          transcriptsByMeeting.set(key, []);
        }
        transcriptsByMeeting.get(key)!.push(transcript);
      });

      // Sort meetings by date (most recent first)
      const sortedMeetings = Array.from(transcriptsByMeeting.entries())
        .sort(([, transcriptsA], [, transcriptsB]) => {
          const dateA = transcriptsA[0]?.meetingDate || new Date(0);
          const dateB = transcriptsB[0]?.meetingDate || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

      sortedMeetings.forEach(([meetingId, transcripts]) => {
        const firstTranscript = transcripts[0];
        if (firstTranscript) {
          prompt += `\n--- ${firstTranscript.meetingType} (${firstTranscript.meetingDate.toDateString()}) ---\n`;
          transcripts.forEach(transcript => {
            const similarityInfo = transcript.similarity ? ` (relevance: ${(transcript.similarity * 100).toFixed(0)}%)` : '';
            prompt += `${transcript.speaker}: ${transcript.text}${similarityInfo}\n`;
          });
        }
      });
    }

    return prompt;
  }

  /**
   * Delete all embeddings for a meeting
   */
  async deleteEmbeddings(meetingId: string): Promise<void> {
    try {
      // Delete from Pinecone
      await this.pineconeService.deleteTranscriptsByMeeting(meetingId);
      
      console.log(`✅ Deleted embeddings for meeting ${meetingId} from Pinecone`);
    } catch (error) {
      console.error(`❌ Error deleting embeddings for meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Get Pinecone index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      return await this.pineconeService.getIndexStats();
    } catch (error) {
      console.error('Error getting Pinecone index stats:', error);
      throw error;
    }
  }
} 