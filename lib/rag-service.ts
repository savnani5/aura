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
   * Get context for AI chat - combines current transcripts with historical context
   */
  async getContextForQuery(
    roomName: string,
    query: string,
    currentTranscripts?: string,
    isLiveMeeting: boolean = false
  ): Promise<RAGContext> {
    try {
      // Generate embedding for the user query
      const queryEmbedding = await this.embeddingsService.generateEmbedding(query);

      // Get room information
      const room = await this.dbService.getMeetingRoomByName(roomName);
      if (!room) {
        return {
          currentTranscripts: [],
          historicalContext: [],
          totalRelevantTranscripts: 0,
          usedContext: false,
        };
      }

      // Process current transcripts if provided (for live meetings)
      const currentTranscriptContext: TranscriptContext[] = [];
      if (currentTranscripts && isLiveMeeting) {
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
      }

      // Get historical meetings for this room
      const historicalMeetings = await this.dbService.getMeetingsByRoomWithFilters({
        roomId: room._id,
        limit: 50, // Get recent meetings
      });

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

      // Find most relevant historical context
      const relevantHistorical = this.embeddingsService.findMostSimilar(
        queryEmbedding.embedding,
        historicalTranscripts,
        5, // Top 5 most relevant
        0.6 // Lower threshold for more context
      );

      const historicalContext = relevantHistorical.map(item => ({
        ...item.metadata,
        similarity: item.similarity,
      }));

      return {
        currentTranscripts: currentTranscriptContext,
        historicalContext,
        totalRelevantTranscripts: historicalContext.length,
        usedContext: historicalContext.length > 0 || currentTranscriptContext.length > 0,
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