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

export interface AIChatResponse {
  message: string;
  usedWebSearch?: boolean;
  usedContext?: boolean;
  relevantTranscripts?: number;
  citations?: string[];
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
    return `You are Ohm, a helpful AI assistant for video meetings. Be concise and direct in your responses.

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

  // Check if message is a web search request
  private isWebSearchRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return lowerMessage.startsWith('@web ') || 
           lowerMessage.includes('search the web') || 
           lowerMessage.includes('latest information') ||
           lowerMessage.includes('current news') ||
           lowerMessage.includes('recent developments');
  }

  // Extract search query from web search request
  private extractWebSearchQuery(message: string): string {
    // If it starts with @web, extract everything after
    if (message.toLowerCase().startsWith('@web ')) {
      return message.slice(5).trim();
    }
    // Otherwise, use the full message as search query
    return message;
  }

  // Process AI chat request
  async processChat(
    message: string,
    roomName: string,
    userName: string,
    currentTranscripts?: string,
    isLiveMeeting: boolean = false
  ): Promise<AIChatResponse> {
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

      // Get RAG context (current + historical)
      const ragContext = await this.ragService.getContextForQuery(
        roomName,
        message,
        currentTranscripts,
        isLiveMeeting
      );

      // Get room stats for additional context
      const roomStats = await this.ragService.getRoomStats(roomName);

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
          max_uses: 3
        });
      }

      // Get AI response from Claude
      const requestParams: any = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages,
      };

      // Add tools if web search is needed
      if (tools.length > 0) {
        requestParams.tools = tools;
      }

      const response = await anthropic.messages.create(requestParams);

      // Extract response text and citations
      let aiResponse = '';
      const citations: string[] = [];
      let usedWebSearch = false;

      for (const content of response.content) {
        if (content.type === 'text') {
          aiResponse += content.text;
          
          // Check for citations in the text content
          if (content.citations) {
            for (const citation of content.citations) {
              if (citation.type === 'web_search_result_location') {
                citations.push(citation.url);
                usedWebSearch = true;
              }
            }
          }
        }
      }

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

      return {
        message: aiResponse,
        usedWebSearch,
        usedContext: ragContext.usedContext,
        relevantTranscripts: ragContext.totalRelevantTranscripts,
        citations: citations.length > 0 ? citations : undefined,
      };

    } catch (error) {
      console.error('Error processing chat:', error);
      throw new Error('Failed to process chat request');
    }
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

      // Get RAG context (current + historical)
      const ragContext = await this.ragService.getContextForQuery(
        roomName,
        message,
        currentTranscripts,
        isLiveMeeting
      );

      // Send context chunk
      onChunk({
        type: 'context',
        usedContext: ragContext.usedContext,
        relevantTranscripts: ragContext.totalRelevantTranscripts
      });

      // Get room stats for additional context
      const roomStats = await this.ragService.getRoomStats(roomName);

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
          max_uses: 3
        });
      }

      // Get AI response from Claude with streaming
      const requestParams: any = {
        model: 'claude-sonnet-4-20250514',
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
      let aiResponse = '';
      const citations: string[] = [];
      let usedWebSearch = false;

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
      onChunk({
        type: 'error',
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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