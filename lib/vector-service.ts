import OpenAI from 'openai';

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
  private transcripts: Map<string, MeetingTranscript[]> = new Map();

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

  // Store meeting transcript with embedding
  async storeMeetingTranscript(transcript: Omit<MeetingTranscript, 'embedding'>): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(transcript.content);
      const transcriptWithEmbedding: MeetingTranscript = {
        ...transcript,
        embedding,
      };

      if (!this.transcripts.has(transcript.roomName)) {
        this.transcripts.set(transcript.roomName, []);
      }

      const roomTranscripts = this.transcripts.get(transcript.roomName)!;
      roomTranscripts.push(transcriptWithEmbedding);

      // Keep only last 100 transcripts per room to manage memory
      if (roomTranscripts.length > 100) {
        roomTranscripts.splice(0, roomTranscripts.length - 100);
      }

      console.log(`Stored transcript for room ${transcript.roomName}`);
    } catch (error) {
      console.error('Error storing meeting transcript:', error);
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
      const allTranscripts: MeetingTranscript[] = [];

      // Get transcripts from current room and similar rooms
      for (const [room, transcripts] of this.transcripts.entries()) {
        if (room === roomName || room.includes(roomName.split('-')[0])) {
          allTranscripts.push(...transcripts);
        }
      }

      // Calculate similarities and sort
      const transcriptsWithSimilarity = allTranscripts
        .filter(transcript => transcript.embedding)
        .map(transcript => ({
          transcript,
          similarity: this.cosineSimilarity(queryEmbedding, transcript.embedding!),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return transcriptsWithSimilarity.map(item => item.transcript);
    } catch (error) {
      console.error('Error searching relevant transcripts:', error);
      return [];
    }
  }

  // Get chat context for AI assistant
  async getChatContext(
    query: string,
    roomName: string,
    currentTranscripts: string
  ): Promise<ChatContext> {
    const relevantHistory = await this.searchRelevantTranscripts(query, roomName);
    
    return {
      currentTranscripts,
      relevantHistory,
    };
  }

  // Clear old transcripts (can be called periodically)
  clearOldTranscripts(olderThanDays: number = 30): void {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    for (const [roomName, transcripts] of this.transcripts.entries()) {
      const filteredTranscripts = transcripts.filter(
        transcript => transcript.timestamp > cutoffTime
      );
      
      if (filteredTranscripts.length === 0) {
        this.transcripts.delete(roomName);
      } else {
        this.transcripts.set(roomName, filteredTranscripts);
      }
    }
  }

  // Debug methods for testing
  getAllTranscripts(): Map<string, MeetingTranscript[]> {
    return this.transcripts;
  }

  getTranscriptsForRoom(roomName: string): MeetingTranscript[] {
    return this.transcripts.get(roomName) || [];
  }

  getTotalTranscriptCount(): number {
    return Array.from(this.transcripts.values()).reduce((sum, arr) => sum + arr.length, 0);
  }

  clearAllTranscripts(): void {
    this.transcripts.clear();
  }
} 