import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../database/mongodb';
import { HybridRAGService } from './hybrid-rag';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}



export class AIChatbot {
  private static instance: AIChatbot;
  private dbService: DatabaseService;
  private ragService: HybridRAGService;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.ragService = HybridRAGService.getInstance();
  }

  static getInstance(): AIChatbot {
    if (!AIChatbot.instance) {
      AIChatbot.instance = new AIChatbot();
    }
    return AIChatbot.instance;
  }

  // System prompt for the AI assistant
  private getSystemPrompt(): string {
    return `You are Aura, a helpful AI assistant for video meetings. Be concise and direct in your responses.

CAPABILITIES:
- Meeting summaries, decisions, action items
- Task management and participant assignments  
- Conversation analysis and participant interactions
- Platform features and meeting support
- General meeting assistance and advice

RESPONSE STYLE:
- Keep responses brief and to the point
- Use bullet points or numbered lists when appropriate
- Provide direct answers without excessive elaboration
- Focus on actionable information
- If context is extensive, summarize key points only

CONTEXT ANALYSIS:
- You have access to complete meeting transcripts and summaries from this room
- Individual transcripts show exact speaker quotes and statements
- Meeting summaries provide comprehensive overviews
- Use the provided context to give specific, detailed answers

RESPONSE GUIDELINES:
- When you have relevant context, use it confidently to provide specific answers
- Quote exact phrases from transcripts when available
- Reference meeting dates and participants from the context
- Only say "I don't have access" if NO relevant context is provided
- If context exists but doesn't contain the specific information, say "Based on the available transcripts, I don't see information about X"

PLATFORM FEATURES (explain briefly if asked):
- Live meetings with real-time transcription and AI
- Meeting rooms with shared context and tasks
- AI summaries and action item extraction
- Historical meeting search and context
- Task creation with assignments and priorities
- Web search integration for real-time information (@web command)

Always analyze all provided context before stating information isn't available.`;
  }

  // Check if message is a web search request (now always enabled for auto-detection)
  private isWebSearchRequest(message: string): boolean {
    // Always enable web search tool and let Claude decide when to use it
    return true;
  }

  // Extract search query from web search request
  private extractWebSearchQuery(message: string): string {
    // Use the full message as search query (Claude will decide what to search for)
    return message;
  }



  // Process AI chat request with streaming
  async processChatStream(
    message: string,
    roomName: string,
    userName: string,
    onChunk: (chunk: any) => void,
    currentTranscripts?: string,
    isLiveMeeting: boolean = false
  ): Promise<void> {
    try {
      // Get conversation history for this room
      const conversationKey = `${roomName}-ai`;
      let history = this.conversationHistory.get(conversationKey) || [];

      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      history.push(userMessage);

      // Check if this is a web search request
      const needsWebSearch = this.isWebSearchRequest(message);
      let searchQuery = '';
      
      if (needsWebSearch) {
        searchQuery = this.extractWebSearchQuery(message);
      }

      // Send initial chunk with metadata
      onChunk({
        type: 'metadata',
        processing: true,
        needsWebSearch,
        searchQuery
      });

      // Get RAG context (current + historical) with performance timing
      const ragStartTime = Date.now();
      const ragContext = await this.ragService.getContextForQuery(
        roomName,
        message,
        currentTranscripts,
        isLiveMeeting
      );
      const ragEndTime = Date.now();
      console.log(`⏱️ [Streaming] RAG context retrieval took ${ragEndTime - ragStartTime}ms`);

      // Send context chunk
      onChunk({
        type: 'context',
        usedContext: ragContext.usedContext,
        relevantTranscripts: ragContext.totalRelevantTranscripts
      });

      // Get room stats for additional context
      const statsStartTime = Date.now();
      const roomStats = await this.ragService.getRoomStats(roomName);
      const statsEndTime = Date.now();
      console.log(`⏱️ [Streaming] Room stats retrieval took ${statsEndTime - statsStartTime}ms`);

      // Prepare system prompt with context
      let systemPrompt = this.getSystemPrompt();
      
      // Add room context
      if (roomStats.totalMeetings > 0) {
        systemPrompt += `\n\nROOM CONTEXT:`;
        systemPrompt += `\nRoom: ${roomName}`;
        systemPrompt += `\nTotal meetings: ${roomStats.totalMeetings}`;
        systemPrompt += `\nTotal transcripts: ${roomStats.totalTranscripts}`;
        if (roomStats.recentMeetingTypes.length > 0) {
          systemPrompt += `\nMeeting types: ${roomStats.recentMeetingTypes.join(', ')}`;
        }
        if (roomStats.frequentParticipants.length > 0) {
          systemPrompt += `\nFrequent participants: ${roomStats.frequentParticipants.join(', ')}`;
        }
      }

      // Add meeting context if available
      const contextPrompt = this.ragService.formatContextForPrompt(ragContext);
      if (contextPrompt.trim()) {
        systemPrompt += `\n\n${contextPrompt}`;
        systemPrompt += `Use this context to provide specific and relevant answers. Keep responses concise - summarize key points rather than repeating lengthy details.`;
      }

      // Add current transcripts for live meetings
      if (isLiveMeeting && currentTranscripts && currentTranscripts.trim()) {
        systemPrompt += `\n\nCURRENT LIVE MEETING TRANSCRIPTS:\n${currentTranscripts}`;
        systemPrompt += `\n\nThese are the most recent transcripts from the ongoing meeting. Use them to answer questions about what's currently being discussed, recent decisions, or immediate context. Prioritize this current information when relevant to the user's question.`;
      }

      // If web search is needed, modify the system prompt
      if (needsWebSearch) {
        systemPrompt += `\n\nThe user is requesting information that may require web search. Use the web search tool to find current, relevant information about: "${searchQuery}"`;
      }

      // Prepare messages for Anthropic (recent conversation history)
      const recentHistory = history.slice(-10);
      const messages: Anthropic.Messages.MessageParam[] = recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Prepare tools array - include web search if needed
      const tools: any[] = [];
      if (needsWebSearch) {
        tools.push({
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 2  // Reduced from 3 to 2 for faster responses
        });
      }

      // Get AI response from Claude with streaming and retry logic
      let aiResponse = '';
      const citations: string[] = [];
      let usedWebSearch = false;
      let streamCompleted = false;

      // Try with Claude 4 first, then fallback to Claude 3.5 Sonnet
      const models = ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219'];
      let lastError: Error | null = null;

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        
        try {
          console.log(`🤖 Attempting AI response with model: ${model} (attempt ${i + 1}/${models.length})`);
          
          const requestParams: any = {
            model: model,
            max_tokens: 1000,
            temperature: 0.7,
            system: systemPrompt,
            messages,
            stream: true,
          };

          // Add tools if web search is needed
          if (tools.length > 0) {
            requestParams.tools = tools;
          }

          const stream = anthropic.messages.stream(requestParams);

          // Process streaming response
          aiResponse = ''; // Reset for retry
          
          stream.on('text', (text) => {
            aiResponse += text;
            
            // Send text chunk to client
            onChunk({
              type: 'text',
              content: text,
              complete: false
            });
          });

          stream.on('end', () => {
            streamCompleted = true;
            
            // Check for citations if this was a web search
            if (needsWebSearch) {
              // Extract citations from the response
              const citationMatches = aiResponse.match(/\[(\d+)\]\s*\(([^)]+)\)/g);
              if (citationMatches) {
                citationMatches.forEach(match => {
                  const urlMatch = match.match(/\(([^)]+)\)/);
                  if (urlMatch) {
                    citations.push(urlMatch[1]);
                    usedWebSearch = true;
                  }
                });
              }
            }
          });

          // Wait for the stream to complete
          await stream.finalMessage();
          
          if (streamCompleted) {
            console.log(`✅ Successfully completed with model: ${model}`);
            break; // Success, exit retry loop
          }
          
        } catch (error) {
          console.error(`❌ Model ${model} failed:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          // If this is the last model, we'll handle the error after the loop
          if (i === models.length - 1) {
            throw lastError;
          }
          
          // Send retry notification to client
          onChunk({
            type: 'retry',
            model: model,
            nextModel: models[i + 1],
            attempt: i + 1,
            totalAttempts: models.length
          });
          
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Send final chunk with complete response
      onChunk({
        type: 'complete',
        content: aiResponse,
        usedWebSearch,
        usedContext: ragContext.usedContext,
        relevantTranscripts: ragContext.totalRelevantTranscripts,
        citations: citations.length > 0 ? citations : undefined,
        timestamp: Date.now()
      });

      // Add AI response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      };
      history.push(assistantMessage);

      // Update conversation history (keep last 20 messages)
      if (history.length > 20) {
        history = history.slice(-20);
      }
      this.conversationHistory.set(conversationKey, history);

    } catch (error) {
      console.error('Error processing streaming chat:', error);
      
      // Check if this is an Anthropic API error
      const isAnthropicError = error instanceof Error && (
        error.message.includes('overloaded') ||
        error.message.includes('Overloaded') ||
        error.message.includes('rate_limit') ||
        error.message.includes('service_unavailable')
      );
      
      if (isAnthropicError) {
        // Send a gentle fallback message for Anthropic API issues
        onChunk({
          type: 'error',
          error: 'AI assistant temporarily unavailable',
          message: "I'm experiencing some technical difficulties right now. Please try again in a moment - I'll be back shortly! 🤖",
          isTemporary: true,
          retryable: true
        });
      } else {
        // Generic error for other issues
        onChunk({
          type: 'error',
          error: 'Failed to process chat request',
          details: error instanceof Error ? error.message : 'Unknown error',
          isTemporary: false,
          retryable: false
        });
      }
    }
  }

  // Clear conversation history for a room
  clearConversationHistory(roomName: string): void {
    const conversationKey = `${roomName}-ai`;
    this.conversationHistory.delete(conversationKey);
  }

  // Get conversation history for a room
  getConversationHistory(roomName: string): ChatMessage[] {
    const conversationKey = `${roomName}-ai`;
    return this.conversationHistory.get(conversationKey) || [];
  }
} 