import { DatabaseService, IMeeting } from './mongodb';
import { EmbeddingsService } from './embeddings-service';

export interface TranscriptContext {
  speaker: string;
  text: string;
  timestamp: Date;
  meetingId: string;
  meetingTitle?: string;
  meetingType: string;
  similarity?: number;
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
  private detectQueryType(query: string): 'comprehensive' | 'targeted' {
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
        return {
          currentTranscripts: [],
          historicalContext: [],
          totalRelevantTranscripts: 0,
          usedContext: false,
        };
      }

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
            });
          }
        }
        console.log(`📝 Processed ${currentTranscriptContext.length} current transcript entries`);
      } else {
        console.log(`🚫 No current transcripts - currentTranscripts: ${!!currentTranscripts}, isLiveMeeting: ${isLiveMeeting}`);
      }

      // Get historical meetings for this room
      const historicalMeetings = await this.dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: queryType === 'comprehensive' ? 20 : 10, // More meetings for comprehensive queries
      });

      console.log(`📚 Found ${historicalMeetings.length} historical meetings`);

      // Extract all historical transcripts with embeddings
      const historicalTranscripts: Array<{
        embedding: number[];
        metadata: TranscriptContext;
      }> = [];

      for (const meeting of historicalMeetings) {
        if (meeting.transcripts && meeting.transcripts.length > 0) {
          for (const transcript of meeting.transcripts) {
            if (transcript.embedding && transcript.embedding.length > 0) {
              historicalTranscripts.push({
                embedding: transcript.embedding,
                metadata: {
                  speaker: transcript.speaker,
                  text: transcript.text,
                  timestamp: transcript.timestamp,
                  meetingId: meeting._id,
                  meetingTitle: meeting.title,
                  meetingType: meeting.type,
                },
              });
            }
          }
        }
      }

      console.log(`📝 Found ${historicalTranscripts.length} historical transcripts with embeddings`);

      let historicalContext: TranscriptContext[] = [];

      if (queryType === 'comprehensive') {
        // For comprehensive queries, include more context with lower threshold
        console.log(`🌐 Using comprehensive retrieval strategy`);
        
        // Get more results with a lower threshold for comprehensive coverage
        const relevantHistorical = this.embeddingsService.findMostSimilar(
          queryEmbedding.embedding,
          historicalTranscripts,
          25, // More results for comprehensive queries
          0.3  // Lower threshold to capture more relevant content
        );

        // If we still don't get enough results, include recent transcripts
        if (relevantHistorical.length < 15) {
          console.log(`📈 Comprehensive query needs more context, including recent transcripts`);
          
          // Sort by recency and include recent transcripts even with lower similarity
          const recentTranscripts = historicalTranscripts
            .map(item => ({
              ...item.metadata,
              similarity: this.embeddingsService.calculateCosineSimilarity(
                queryEmbedding.embedding, 
                item.embedding
              ),
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20); // Top 20 most recent

          // Combine similarity-based and recency-based results
          const combinedResults = new Map();
          
          // Add similarity-based results first
          relevantHistorical.forEach(item => {
            combinedResults.set(`${item.metadata.meetingId}-${item.metadata.timestamp}`, {
              ...item.metadata,
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
          historicalContext = relevantHistorical.map(item => ({
            ...item.metadata,
            similarity: item.similarity,
          }));
        }

      } else {
        // For targeted queries, use higher threshold and fewer results
        console.log(`🎯 Using targeted retrieval strategy`);
        
        const relevantHistorical = this.embeddingsService.findMostSimilar(
          queryEmbedding.embedding,
          historicalTranscripts,
          8, // Fewer, more relevant results
          0.5 // Higher threshold for more precise matches
        );

        historicalContext = relevantHistorical.map(item => ({
          ...item.metadata,
          similarity: item.similarity,
        }));
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
      const meeting = await this.dbService.getMeetingById(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Generate embeddings for all transcripts
      const transcriptTexts = transcripts.map(t => `${t.speaker}: ${t.text}`);
      const embeddings = await this.embeddingsService.generateEmbeddings(transcriptTexts);

      // Update meeting with transcripts and embeddings
      const transcriptsWithEmbeddings = transcripts.map((transcript, index) => ({
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp,
        embedding: embeddings[index]?.embedding || [],
      }));

      // Update the meeting in database
      await this.dbService.updateMeeting(meetingId, {
        transcripts: transcriptsWithEmbeddings,
      });

      console.log(`Stored ${transcriptsWithEmbeddings.length} transcripts with embeddings for meeting ${meetingId}`);
    } catch (error) {
      console.error('Error storing transcript embeddings:', error);
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
        const meetingInfo = transcript.meetingTitle || transcript.meetingType;
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

      const meetings = await this.dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: 20,
      });

      const totalTranscripts = meetings.reduce((sum, meeting) => 
        sum + (meeting.transcripts?.length || 0), 0
      );

      const meetingTypes = [...new Set(meetings.map(m => m.type))];
      
      const participantCounts: Record<string, number> = {};
      meetings.forEach(meeting => {
        meeting.participants.forEach(participant => {
          participantCounts[participant.name] = (participantCounts[participant.name] || 0) + 1;
        });
      });

      const frequentParticipants = Object.entries(participantCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);

      return {
        totalMeetings: meetings.length,
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