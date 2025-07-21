import OpenAI from 'openai';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing or empty');
  }
  return new OpenAI({ apiKey });
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  tokens: number;
}

export class EmbeddingsService {
  private static instance: EmbeddingsService;

  static getInstance(): EmbeddingsService {
    if (!EmbeddingsService.instance) {
      EmbeddingsService.instance = new EmbeddingsService();
    }
    return EmbeddingsService.instance;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      if (!text.trim()) {
        throw new Error('Text cannot be empty');
      }

      const response = await getOpenAIClient().embeddings.create({
        model: 'text-embedding-3-small',
        input: text.trim(),
        encoding_format: 'float',
      });

      const embedding = response.data[0];
      
      return {
        embedding: embedding.embedding,
        text: text.trim(),
        tokens: response.usage.total_tokens,
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      // Filter out empty texts
      const validTexts = texts.filter(text => text.trim());
      if (validTexts.length === 0) {
        return [];
      }

      // OpenAI allows up to 2048 inputs per request for embeddings
      const batchSize = 100; // Conservative batch size
      const results: EmbeddingResult[] = [];

      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);
        
        const response = await getOpenAIClient().embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
          encoding_format: 'float',
        });

        const batchResults = response.data.map((embedding, index) => ({
          embedding: embedding.embedding,
          text: batch[index],
          tokens: response.usage.total_tokens / batch.length, // Approximate tokens per text
        }));

        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding for transcript text (speaker + content)
   */
  async generateTranscriptEmbedding(speaker: string, text: string): Promise<EmbeddingResult> {
    const transcriptText = `${speaker}: ${text}`;
    return this.generateEmbedding(transcriptText);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Find most similar embeddings from a list
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ embedding: number[]; metadata: any }>,
    topK: number = 5,
    threshold: number = 0.7
  ): Array<{ similarity: number; metadata: any }> {
    const similarities = candidateEmbeddings.map(candidate => ({
      similarity: this.calculateCosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata,
    }));

    // Filter by threshold and sort by similarity (descending)
    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
} 