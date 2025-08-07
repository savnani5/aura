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
  searchStrategy?: 'local_only' | 'local_first' | 'web_required';
  queryAnalysis?: {
    type: 'comprehensive' | 'targeted' | 'specific';
    searchStrategy: 'local_only' | 'local_first' | 'web_required';
    summaryPriority: 'high' | 'medium' | 'low';
    adaptiveThreshold: number;
    reasoning: string;
  };
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

      // Intelligent query analysis using LLM reasoning
      const queryAnalysis = await this.analyzeQueryIntelligently(query);
      console.log(`🎯 Query analysis: ${queryAnalysis.type} (${queryAnalysis.reasoning})`);
      console.log(`🔍 Search strategy: ${queryAnalysis.searchStrategy}`);
      console.log(`📊 Summary priority: ${queryAnalysis.summaryPriority}, Threshold: ${queryAnalysis.adaptiveThreshold}`);

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

      // Get historical context using intelligent hybrid approach
      const historicalContext = await this.getIntelligentHistoricalContext(
        room._id,
        queryEmbedding.embedding,
        queryAnalysis
      );

      // Add search strategy to context for downstream use
      const contextWithStrategy = {
        currentTranscripts: currentTranscriptContext,
        historicalContext,
        totalRelevantTranscripts: historicalContext.length + currentTranscriptContext.length,
        usedContext: historicalContext.length > 0 || currentTranscriptContext.length > 0,
        searchStrategy: queryAnalysis.searchStrategy,
        queryAnalysis: queryAnalysis
      };

      console.log(`✅ Retrieved ${historicalContext.length} relevant historical transcripts`);
      console.log(`📋 Current transcript context: ${currentTranscriptContext.length} entries`);
      
      const totalRelevantTranscripts = historicalContext.length + currentTranscriptContext.length;
      const usedContext = historicalContext.length > 0 || currentTranscriptContext.length > 0;
      
      console.log(`🎯 Total relevant transcripts: ${totalRelevantTranscripts}, Used context: ${usedContext}`);
      
      return contextWithStrategy;

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
   * Get historical context using intelligent approach: LLM-driven retrieval with adaptive strategies
   */
  private async getIntelligentHistoricalContext(
    roomId: string,
    queryEmbedding: number[],
    queryAnalysis: {
      type: 'comprehensive' | 'targeted' | 'specific';
      summaryPriority: 'high' | 'medium' | 'low';
      adaptiveThreshold: number;
    }
  ): Promise<TranscriptContext[]> {
    try {
      // Step 1: Use adaptive parameters based on LLM analysis
      const topK = queryAnalysis.type === 'comprehensive' ? 25 : queryAnalysis.type === 'targeted' ? 20 : 15;
      const threshold = queryAnalysis.adaptiveThreshold;
      
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

      // Step 3: Intelligently combine results based on summary priority
      const historicalContext: TranscriptContext[] = [];
      
      // Add meeting summaries with priority-based weighting
      if (queryAnalysis.summaryPriority === 'high') {
        console.log(`📊 High summary priority - prioritizing meeting summaries`);
        for (const meeting of meetings) {
          if (meeting.summary && meeting.summary.content) {
            // Add comprehensive summary content for high priority
            historicalContext.push({
              speaker: 'AI Summary',
              text: `Meeting Summary: ${meeting.summary.content}`,
              timestamp: meeting.startedAt,
              meetingId: meeting._id,
              meetingType: `${meeting.type} (All participants: ${meeting.participants?.map(p => p.name).join(', ') || 'Unknown'})`,
              meetingDate: meeting.startedAt,
              similarity: 0.95 // Very high relevance for high-priority summaries
            });

            // Also add structured sections if available
            if (meeting.summary.sections && meeting.summary.sections.length > 0) {
              meeting.summary.sections.forEach((section, index) => {
                if (section.title && section.points && section.points.length > 0) {
                  const sectionText = `${section.title}: ${section.points.map(p => p.text).join('; ')}`;
                  historicalContext.push({
                    speaker: 'AI Summary Section',
                    text: sectionText,
                    timestamp: meeting.startedAt,
                    meetingId: meeting._id,
                    meetingType: `${meeting.type} - ${section.title}`,
                    meetingDate: meeting.startedAt,
                    similarity: 0.90 - (index * 0.05) // Slightly lower for each section
                  });
                }
              });
            }
          }
        }
      } else if (queryAnalysis.summaryPriority === 'medium') {
        // Standard summary inclusion
        for (const meeting of meetings) {
          if (meeting.summary && meeting.summary.content) {
            historicalContext.push({
              speaker: 'AI Summary',
              text: `Meeting Summary: ${meeting.summary.content}`,
              timestamp: meeting.startedAt,
              meetingId: meeting._id,
              meetingType: `${meeting.type} (All participants: ${meeting.participants?.map(p => p.name).join(', ') || 'Unknown'})`,
              meetingDate: meeting.startedAt,
              similarity: 0.80 // Standard relevance for summaries
            });
          }
        }
      }
      // For low priority, skip summaries and focus on transcripts

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

      // Sort by relevance using intelligent priority system
      historicalContext.sort((a, b) => {
        // High priority: Prioritize summaries and sections
        if (queryAnalysis.summaryPriority === 'high') {
          const aIsSummary = a.speaker.includes('AI Summary');
          const bIsSummary = b.speaker.includes('AI Summary');
          if (aIsSummary && !bIsSummary) return -1;
          if (bIsSummary && !aIsSummary) return 1;
        }
        
        // Low priority: Prioritize transcripts over summaries
        if (queryAnalysis.summaryPriority === 'low') {
          const aIsSummary = a.speaker.includes('AI Summary');
          const bIsSummary = b.speaker.includes('AI Summary');
          if (!aIsSummary && bIsSummary) return -1;
          if (!bIsSummary && aIsSummary) return 1;
        }
        
        // Then by similarity/relevance
        const aSimilarity = a.similarity || 0;
        const bSimilarity = b.similarity || 0;
        if (Math.abs(aSimilarity - bSimilarity) > 0.05) {
          return bSimilarity - aSimilarity;
        }
        
        // Finally by recency
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Adaptive result limits based on analysis
      const maxResults = queryAnalysis.type === 'comprehensive' ? 30 : 
                        queryAnalysis.type === 'targeted' ? 20 : 15;
      
      console.log(`📊 Returning ${Math.min(historicalContext.length, maxResults)} results (${queryAnalysis.summaryPriority} priority)`);
      return historicalContext.slice(0, maxResults);

    } catch (error) {
      console.error('Error getting hybrid historical context:', error);
      return [];
    }
  }

  /**
   * Intelligent query analysis using LLM reasoning
   */
  private async analyzeQueryIntelligently(query: string): Promise<{
    type: 'comprehensive' | 'targeted' | 'specific';
    searchStrategy: 'local_only' | 'local_first' | 'web_required';
    summaryPriority: 'high' | 'medium' | 'low';
    adaptiveThreshold: number;
    reasoning: string;
  }> {
    try {
      // Use Claude for intelligent query analysis
      const anthropic = new (await import('@anthropic-ai/sdk')).default({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const analysisPrompt = `Analyze this user query to determine optimal retrieval strategy:

Query: "${query}"

Consider:
1. Query type: comprehensive (broad overview), targeted (specific topic), or specific (exact detail)
2. Search strategy: local_only (meeting context), local_first (try local then web), web_required (external info needed)
3. Summary priority: high (summaries most useful), medium (balanced), low (transcripts preferred)
4. Similarity threshold: 0.2-0.5 (lower = more results, higher = more precise)

Respond in JSON format:
{
  "type": "comprehensive|targeted|specific",
  "searchStrategy": "local_only|local_first|web_required", 
  "summaryPriority": "high|medium|low",
  "adaptiveThreshold": 0.2-0.5,
  "reasoning": "brief explanation of decisions"
}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 300,
        temperature: 0.1,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const analysis = JSON.parse(content.text);
          console.log(`🧠 LLM Query Analysis: ${analysis.reasoning}`);
          return {
            type: analysis.type || 'targeted',
            searchStrategy: analysis.searchStrategy || 'local_first',
            summaryPriority: analysis.summaryPriority || 'medium',
            adaptiveThreshold: Math.max(0.2, Math.min(0.5, analysis.adaptiveThreshold || 0.3)),
            reasoning: analysis.reasoning || 'LLM analysis completed'
          };
        } catch (parseError) {
          console.warn('Failed to parse LLM analysis, using heuristics');
          return this.analyzeQueryHeuristically(query);
        }
      }
      
      return this.analyzeQueryHeuristically(query);
      
    } catch (error) {
      console.warn('LLM query analysis failed, falling back to heuristics:', error);
      return this.analyzeQueryHeuristically(query);
    }
  }

  /**
   * Heuristic-based query analysis (fallback)
   */
  private analyzeQueryHeuristically(query: string): {
    type: 'comprehensive' | 'targeted' | 'specific';
    searchStrategy: 'local_only' | 'local_first' | 'web_required';
    summaryPriority: 'high' | 'medium' | 'low';
    adaptiveThreshold: number;
    reasoning: string;
  } {
    const queryLower = query.toLowerCase();
    
    // Check for web-required indicators
    const webRequiredKeywords = [
      'current news', 'latest', 'recent developments', 'what\'s happening now',
      'market trends', 'stock price', 'weather', 'breaking news'
    ];
    
    // Check for local-context indicators
    const localContextKeywords = [
      'tool stack', 'tools', 'what tools', 'technology stack', 'tech stack',
      'discussed', 'mentioned', 'said', 'talked about', 'meeting',
      'transcript', 'conversation', 'our discussion'
    ];
    
    // Check for comprehensive indicators
    const comprehensiveKeywords = [
      'summary', 'overview', 'what happened', 'tell me about', 'explain',
      'context', 'background', 'history', 'all about', 'everything'
    ];
    
    // Check for specific indicators
    const specificKeywords = [
      'when did', 'who said', 'what time', 'specific', 'exact', 'particular',
      'find', 'search', 'locate', 'show me', 'which', 'what is'
    ];

    // Determine search strategy
    let searchStrategy: 'local_only' | 'local_first' | 'web_required' = 'local_first';
    
    if (webRequiredKeywords.some(keyword => queryLower.includes(keyword))) {
      searchStrategy = 'web_required';
    } else if (localContextKeywords.some(keyword => queryLower.includes(keyword))) {
      searchStrategy = 'local_only';
    }
    
    // Determine query type
    let type: 'comprehensive' | 'targeted' | 'specific' = 'targeted';
    
    if (comprehensiveKeywords.some(keyword => queryLower.includes(keyword))) {
      type = 'comprehensive';
    } else if (specificKeywords.some(keyword => queryLower.includes(keyword))) {
      type = 'specific';
    }
    
    // Determine summary priority based on query characteristics
    let summaryPriority: 'high' | 'medium' | 'low' = 'medium';
    let adaptiveThreshold = 0.3;

    const summaryPreferredKeywords = [
      'tool stack', 'technology stack', 'tech stack', 'tools used', 'what tools',
      'overview', 'summary', 'main points', 'key topics', 'decisions made',
      'action items', 'outcomes', 'conclusions'
    ];

    const transcriptPreferredKeywords = [
      'who said', 'exact words', 'quote', 'specifically said', 'mentioned',
      'when did', 'what time', 'conversation', 'discussion details'
    ];

    if (summaryPreferredKeywords.some(keyword => queryLower.includes(keyword))) {
      summaryPriority = 'high';
      adaptiveThreshold = 0.25; // Lower threshold for broader retrieval
    } else if (transcriptPreferredKeywords.some(keyword => queryLower.includes(keyword))) {
      summaryPriority = 'low';
      adaptiveThreshold = 0.4; // Higher threshold for precise matches
    } else if (type === 'comprehensive') {
      summaryPriority = 'high';
      adaptiveThreshold = 0.25;
    } else if (type === 'specific') {
      adaptiveThreshold = 0.35;
    }

    return {
      type,
      searchStrategy,
      summaryPriority,
      adaptiveThreshold,
      reasoning: `Query appears to be ${type} and ${searchStrategy === 'local_only' ? 'can be answered from meeting context' : searchStrategy === 'web_required' ? 'requires web search' : 'should try local context first'}. Priority: ${summaryPriority} summaries, threshold: ${adaptiveThreshold}`
    };
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
   * Format context for AI prompt with enhanced extraction
   */
  formatContextForPrompt(context: RAGContext): string {
    let prompt = '';

    // Add query analysis information for the AI
    if (context.queryAnalysis) {
      prompt += `QUERY ANALYSIS:\n`;
      prompt += `Type: ${context.queryAnalysis.type}\n`;
      prompt += `Search Strategy: ${context.queryAnalysis.searchStrategy}\n`;
      prompt += `Reasoning: ${context.queryAnalysis.reasoning}\n\n`;
    }

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
      
      // Separate summaries from transcripts for better organization
      const summaries = context.historicalContext.filter(t => t.speaker === 'AI Summary');
      const transcripts = context.historicalContext.filter(t => t.speaker !== 'AI Summary');
      
      // Show summaries first (highest level context)
      if (summaries.length > 0) {
        prompt += '\n📋 MEETING SUMMARIES:\n';
        summaries.forEach(summary => {
          prompt += `${summary.text}\n\n`;
        });
      }
      
      // Then show relevant transcript excerpts
      if (transcripts.length > 0) {
        prompt += '💬 RELEVANT TRANSCRIPT EXCERPTS:\n';
        
        // Group by meeting for better context
        const transcriptsByMeeting = new Map<string, TranscriptContext[]>();
        transcripts.forEach(transcript => {
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