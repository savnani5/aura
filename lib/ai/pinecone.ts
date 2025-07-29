import { Pinecone } from '@pinecone-database/pinecone';

function getPineconeClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is missing or empty');
  }
  return new Pinecone({ apiKey });
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    meetingId: string;
    roomId: string;
    speaker: string;
    text: string;
    timestamp: string;
    meetingDate: string;
    meetingType: string;
    transcriptIndex: number;
  };
}

export interface PineconeQueryResult {
  id: string;
  score: number;
  metadata: {
    meetingId: string;
    roomId: string;
    speaker: string;
    text: string;
    timestamp: string;
    meetingDate: string;
    meetingType: string;
    transcriptIndex: number;
  };
}

export class PineconeService {
  private static instance: PineconeService;
  private indexName = 'ohm-transcripts';
  private index: any;

  private constructor() {
    this.index = getPineconeClient().index(this.indexName);
  }

  static getInstance(): PineconeService {
    if (!PineconeService.instance) {
      PineconeService.instance = new PineconeService();
    }
    return PineconeService.instance;
  }

  /**
   * Initialize Pinecone index if it doesn't exist
   */
  async initializeIndex(): Promise<void> {
    try {
      // Check if index exists
      const indexes = await getPineconeClient().listIndexes();
      const indexExists = indexes.indexes?.some((idx: any) => idx.name === this.indexName);

      if (!indexExists) {
        console.log(`🚀 Creating Pinecone index: ${this.indexName}`);
        await getPineconeClient().createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI text-embedding-3-small dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        console.log('⏳ Waiting for index to be ready...');
        await this.waitForIndexReady();
      }
      
      console.log(`✅ Pinecone index ${this.indexName} is ready`);
    } catch (error) {
      console.error('❌ Error initializing Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const stats = await this.index.describeIndexStats();
        if (stats) {
          console.log('✅ Index is ready');
          return;
        }
      } catch (error) {
        // Index not ready yet
      }
      
      console.log(`⏳ Waiting for index... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Index failed to become ready within timeout');
  }

  /**
   * Store transcript embeddings in Pinecone
   */
  async storeTranscriptEmbeddings(
    meetingId: string,
    roomId: string,
    meetingType: string,
    meetingDate: Date,
    transcripts: Array<{
      transcriptIndex: number;
      speaker: string;
      text: string;
      timestamp: Date;
      embedding: number[];
    }>
  ): Promise<void> {
    try {
      if (transcripts.length === 0) {
        console.log('⚠️ No transcripts to store in Pinecone');
        return;
      }

      // Convert to Pinecone vectors
      const vectors: PineconeVector[] = transcripts.map(transcript => ({
        id: `${meetingId}-${transcript.transcriptIndex}`,
        values: transcript.embedding,
        metadata: {
          meetingId,
          roomId,
          speaker: transcript.speaker,
          text: transcript.text,
          timestamp: transcript.timestamp.toISOString(),
          meetingDate: meetingDate.toISOString(),
          meetingType,
          transcriptIndex: transcript.transcriptIndex,
        }
      }));

      // Delete existing vectors for this meeting (if any)
      await this.deleteTranscriptsByMeeting(meetingId);

      // Upsert vectors in batches (Pinecone has limits)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(`📤 Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} to Pinecone`);
      }

      console.log(`✅ Successfully stored ${vectors.length} transcript embeddings in Pinecone for meeting ${meetingId}`);
    } catch (error) {
      console.error('❌ Error storing embeddings in Pinecone:', error);
      throw error;
    }
  }

  /**
   * Query Pinecone for similar transcripts
   */
  async queryTranscripts(
    queryEmbedding: number[],
    roomId: string,
    topK: number = 20,
    threshold: number = 0.3
  ): Promise<PineconeQueryResult[]> {
    try {
      const queryRequest = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: {
          roomId: { $eq: roomId }
        }
      };

      console.log(`🔍 Pinecone: Querying room-specific transcripts for roomId: ${roomId}`);
      const queryResponse = await this.index.query(queryRequest);
      
      // Filter by threshold and return results
      const results: PineconeQueryResult[] = queryResponse.matches
        .filter((match: any) => match.score >= threshold)
        .map((match: any) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata
        }));

      console.log(`🔍 Pinecone query returned ${results.length} results above threshold ${threshold}`);
      return results;
    } catch (error) {
      console.error('❌ Error querying Pinecone:', error);
      throw error;
    }
  }

  /**
   * Retrieve all transcripts for a specific meeting from Pinecone
   */
  async getTranscriptsByMeeting(meetingId: string): Promise<Array<{
    speaker: string;
    text: string;
    timestamp: Date;
    transcriptIndex: number;
  }>> {
    try {
      console.log(`📖 Retrieving transcripts for meeting ${meetingId} from Pinecone`);
      
      // Query to get all transcripts for this meeting
      const queryResponse = await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
        topK: 10000, // Large number to get all transcripts
        includeMetadata: true,
        filter: {
          meetingId: { $eq: meetingId }
        }
      });

      if (queryResponse.matches.length === 0) {
        console.log(`📖 No transcripts found for meeting ${meetingId}`);
        return [];
      }

      // Sort by transcript index to maintain chronological order
      const sortedMatches = queryResponse.matches.sort((a: any, b: any) => {
        const indexA = a.metadata?.transcriptIndex || 0;
        const indexB = b.metadata?.transcriptIndex || 0;
        return indexA - indexB;
      });

      // Extract transcript data from metadata
      const transcripts = sortedMatches.map((match: any) => ({
        speaker: match.metadata?.speaker || 'Unknown',
        text: match.metadata?.text || '',
        timestamp: new Date(match.metadata?.timestamp || Date.now()),
        transcriptIndex: match.metadata?.transcriptIndex || 0
      }));

      console.log(`📖 Retrieved ${transcripts.length} transcripts for meeting ${meetingId}`);
      return transcripts;
    } catch (error) {
      console.error('❌ Error retrieving transcripts from Pinecone:', error);
      throw error;
    }
  }

  /**
   * Delete transcripts for a specific meeting
   */
  async deleteTranscriptsByMeeting(meetingId: string): Promise<void> {
    try {
      // Query to get all vector IDs for this meeting
      const queryResponse = await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
        topK: 10000, // Large number to get all vectors
        includeMetadata: true,
        filter: {
          meetingId: { $eq: meetingId }
        }
      });

      if (queryResponse.matches.length > 0) {
        const vectorIds = queryResponse.matches.map((match: any) => match.id);
        await this.index.deleteMany(vectorIds);
        console.log(`🗑️ Deleted ${vectorIds.length} vectors for meeting ${meetingId}`);
      }
    } catch (error) {
      console.error('❌ Error deleting vectors from Pinecone:', error);
      throw error;
    }
  }

  /**
   * Delete all transcripts for a specific room
   */
  async deleteTranscriptsByRoom(roomId: string): Promise<void> {
    try {
      // Query to get all vector IDs for this room
      const queryResponse = await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
        topK: 10000, // Large number to get all vectors
        includeMetadata: true,
        filter: {
          roomId: { $eq: roomId }
        }
      });

      if (queryResponse.matches.length > 0) {
        const vectorIds = queryResponse.matches.map((match: any) => match.id);
        await this.index.deleteMany(vectorIds);
        console.log(`🗑️ Deleted ${vectorIds.length} vectors for room ${roomId}`);
      }
    } catch (error) {
      console.error('❌ Error deleting room vectors from Pinecone:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('❌ Error getting index stats:', error);
      throw error;
    }
  }
} 