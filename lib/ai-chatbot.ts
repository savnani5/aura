import Anthropic from '@anthropic-ai/sdk';
import { VectorService, ChatContext, MeetingTranscript } from './vector-service';
import { DatabaseService } from './prisma';

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
  usedContext: boolean;
  relevantTranscripts: number;
  usedWebSearch?: boolean;
  citations?: string[];
}

export class AIChatbot {
  private static instance: AIChatbot;
  private vectorService: VectorService;
  private dbService: DatabaseService;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.vectorService = VectorService.getInstance();
    this.dbService = DatabaseService.getInstance();
  }

  static getInstance(): AIChatbot {
    if (!AIChatbot.instance) {
      AIChatbot.instance = new AIChatbot();
    }
    return AIChatbot.instance;
  }

  // System prompt for the AI assistant
  private getSystemPrompt(): string {
    return `You are Ohm, a concise AI assistant for video meetings. 

Help with:
- Meeting summaries and decisions
- Action items and follow-ups  
- Transcript insights
- Rephrasing and clarity
- Task management and suggestions

Be brief, direct, and helpful. Reference specific transcript content when relevant. If you lack context, ask short clarifying questions.

When users ask about tasks or action items, you can suggest creating tasks with priorities and assignments based on the meeting discussion.

Note: Meeting types are flexible - users can define any custom meeting type name (like "Daily Standup", "Client Review", "Sprint Planning", etc.).`;
  }

  // Format context for the AI
  private formatContext(context: ChatContext): string {
    let formattedContext = '';

    // Add current meeting transcripts
    if (context.currentTranscripts.trim()) {
      formattedContext += `CURRENT MEETING TRANSCRIPT:\n${context.currentTranscripts}\n\n`;
    }

    // Add relevant historical context
    if (context.relevantHistory.length > 0) {
      formattedContext += `RELEVANT PREVIOUS MEETINGS:\n`;
      context.relevantHistory.forEach((transcript, index) => {
        const date = new Date(transcript.timestamp).toLocaleDateString();
        formattedContext += `\n--- Meeting ${index + 1} (${date}) ---\n`;
        formattedContext += `Room: ${transcript.roomName}\n`;
        formattedContext += `Participants: ${transcript.participants.join(', ')}\n`;
        formattedContext += `Content: ${transcript.content}\n`;
      });
    }

    return formattedContext;
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
    currentTranscripts: string
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

      // Get relevant context from vector database
      const context = await this.vectorService.getChatContext(
        message,
        roomName,
        currentTranscripts
      );

      // Prepare system prompt with context
      let systemPrompt = this.getSystemPrompt();
      
      // Add context if available
      const formattedContext = this.formatContext(context);
      if (formattedContext.trim()) {
        systemPrompt += `\n\nCONTEXT INFORMATION:\n${formattedContext}`;
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
        } else if (content.type === 'web_search_tool_result') {
          // Web search was used
          usedWebSearch = true;
        }
      }

      if (!aiResponse) {
        aiResponse = 'I apologize, but I could not generate a response.';
      }

      // Add AI response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      };
      history.push(assistantMessage);

      // Keep only last 20 messages in history
      if (history.length > 20) {
        history = history.slice(-20);
      }
      this.conversationHistory.set(conversationKey, history);

      return {
        message: aiResponse,
        usedContext: context.relevantHistory.length > 0 || context.currentTranscripts.trim().length > 0,
        relevantTranscripts: context.relevantHistory.length,
        usedWebSearch,
        citations: citations.length > 0 ? citations : undefined,
      };

    } catch (error) {
      console.error('Error processing AI chat:', error);
      return {
        message: 'I apologize, but I encountered an error. Please try again.',
        usedContext: false,
        relevantTranscripts: 0,
        usedWebSearch: false,
      };
    }
  }

  // Store meeting transcript for AI context (updated to use database)
  async storeMeetingTranscript(
    roomName: string,
    transcriptText: string,
    participants: string[]
  ): Promise<void> {
    try {
      // Store in vector service for semantic search
      const transcript: Omit<MeetingTranscript, 'embedding'> = {
        id: `${roomName}-${Date.now()}`,
        roomName,
        content: transcriptText,
        timestamp: Date.now(),
        participants,
      };
      
      await this.vectorService.storeMeetingTranscript(transcript);
      
      // Also store individual transcript entries for better granularity
      const lines = transcriptText.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const [, speaker, text] = match;
          await this.vectorService.storeTranscriptEntry(roomName, speaker.trim(), text.trim());
        }
      }
      
    } catch (error) {
      console.error('Error storing transcript:', error);
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