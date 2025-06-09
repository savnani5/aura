import OpenAI from 'openai';
import { DatabaseService } from './prisma';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MeetingTranscript {
  id: string;
  roomName: string;
  content: string;
  timestamp: number;
  participants: string[];
  embedding?: number[];
}

export interface ChatContext {
  currentTranscripts: string;
  relevantHistory: MeetingTranscript[];
}

export class VectorService {
  private static instance: VectorService;
  private dbService: DatabaseService;

  constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  static getInstance(): VectorService {
    if (!VectorService.instance) {
      VectorService.instance = new VectorService();
    }
    return VectorService.instance;
  }

  // Generate embeddings for text using OpenAI
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Store meeting transcript with embedding in database
  async storeMeetingTranscript(transcript: Omit<MeetingTranscript, 'embedding'>): Promise<void> {
    try {
      // First, get the meeting from database to get meetingId
      const meeting = await this.dbService.getMeeting(transcript.roomName);
      if (!meeting) {
        console.error(`Meeting not found for room: ${transcript.roomName}`);
        return;
      }

      // Generate embedding for the content
      const embedding = await this.generateEmbedding(transcript.content);
      
      // Store transcript in database
      await this.dbService.createTranscript({
        meetingId: meeting.id,
        speaker: transcript.participants[0] || 'Unknown', // For backward compatibility
        text: transcript.content,
        embedding: JSON.stringify(embedding) // Store as JSON string
      });

      console.log(`Stored transcript for room ${transcript.roomName}`);
    } catch (error) {
      console.error('Error storing meeting transcript:', error);
    }
  }

  // Store individual transcript entry with embedding
  async storeTranscriptEntry(
    roomName: string, 
    speaker: string, 
    text: string
  ): Promise<void> {
    try {
      // Get meeting from database
      const meeting = await this.dbService.getMeeting(roomName);
      if (!meeting) {
        console.error(`Meeting not found for room: ${roomName}`);
        return;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(text);
      
      // Store in database
      await this.dbService.createTranscript({
        meetingId: meeting.id,
        speaker,
        text,
        embedding: JSON.stringify(embedding)
      });

    } catch (error) {
      console.error('Error storing transcript entry:', error);
    }
  }

  // Search for relevant transcripts based on query
  async searchRelevantTranscripts(
    query: string, 
    roomName: string, 
    limit: number = 5
  ): Promise<MeetingTranscript[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get meeting from database
      const meeting = await this.dbService.getMeeting(roomName);
      if (!meeting) {
        return [];
      }

      // Get all transcripts for this meeting (could expand to similar meetings later)
      const transcripts = await this.dbService.getTranscriptsForMeeting(meeting.id, 500);
      
      // Calculate similarities and sort
      const transcriptsWithSimilarity = transcripts
        .filter((transcript: any) => transcript.embedding)
        .map((transcript: any) => {
          const embedding = JSON.parse(transcript.embedding!);
          return {
            transcript: {
              id: transcript.id,
              roomName: meeting.roomName,
              content: transcript.text,
              timestamp: transcript.timestamp.getTime(),
              participants: [transcript.speaker],
              embedding
            },
            similarity: this.cosineSimilarity(queryEmbedding, embedding),
          };
        })
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

      return transcriptsWithSimilarity.map((item: any) => item.transcript);
    } catch (error) {
      console.error('Error searching relevant transcripts:', error);
      return [];
    }
  }

  // Get chat context for AI assistant (enhanced with database search)
  async getChatContext(
    query: string,
    roomName: string,
    currentTranscripts: string
  ): Promise<ChatContext> {
    // Get relevant historical transcripts
    const relevantHistory = await this.searchRelevantTranscripts(query, roomName, 3);
    
    // Also search across other meetings of the same type if needed
    try {
      const meeting = await this.dbService.getMeeting(roomName);
      if (meeting?.isRecurring) {
        // For recurring meetings, we could search across previous instances
        // This would require a more complex query - for now, we'll stick to current meeting
      }
    } catch (error) {
      console.error('Error getting meeting context:', error);
    }
    
    return {
      currentTranscripts,
      relevantHistory,
    };
  }

  // Search transcripts across all meetings (for global search)
  async searchGlobalTranscripts(query: string, limit: number = 10): Promise<MeetingTranscript[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Simple text search for now (could be enhanced with vector search later)
      const searchResults = await this.dbService.searchTranscripts(query);
      
      // Convert to MeetingTranscript format
      const transcripts: MeetingTranscript[] = searchResults.map((result: any) => ({
        id: result.id,
        roomName: result.meeting?.roomName || 'Unknown',
        content: result.text,
        timestamp: result.timestamp.getTime(),
        participants: [result.speaker],
      }));

      return transcripts.slice(0, limit);
    } catch (error) {
      console.error('Error searching global transcripts:', error);
      return [];
    }
  }

  // Clear old transcripts (handled by database cleanup now)
  clearOldTranscripts(olderThanDays: number = 30): void {
    // This is now handled by DatabaseService.cleanupOldData()
    console.log('Use DatabaseService.cleanupOldData() for transcript cleanup');
  }

  // Debug methods
  async getTranscriptsForRoom(roomName: string): Promise<MeetingTranscript[]> {
    try {
      const meeting = await this.dbService.getMeeting(roomName);
      if (!meeting) return [];

      const transcripts = await this.dbService.getTranscriptsForMeeting(meeting.id);
      return transcripts.map((t: any) => ({
        id: t.id,
        roomName: meeting.roomName,
        content: t.text,
        timestamp: t.timestamp.getTime(),
        participants: [t.speaker],
        embedding: t.embedding ? JSON.parse(t.embedding) : undefined
      }));
    } catch (error) {
      console.error('Error getting transcripts for room:', error);
      return [];
    }
  }

  async getTotalTranscriptCount(): Promise<number> {
    try {
      const meetings = await this.dbService.getAllMeetings();
      return meetings.reduce((sum: number, meeting: any) => sum + (meeting._count?.transcripts || 0), 0);
    } catch (error) {
      console.error('Error getting total transcript count:', error);
      return 0;
    }
  }

  clearAllTranscripts(): void {
    console.log('Use database operations for clearing transcripts');
  }
} 