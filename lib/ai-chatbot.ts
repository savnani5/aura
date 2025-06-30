import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from './mongodb';
import { RAGService } from './rag-service';

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
  private ragService: RAGService;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.dbService = DatabaseService.getInstance();
    this.ragService = RAGService.getInstance();
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
- You receive context from live meetings and historical transcripts
- Meeting summaries (marked "AI Summary") contain comprehensive overviews
- Individual transcripts show speaker names and their statements
- Check all context thoroughly for participant information

PARTICIPANT QUERIES:
- Search meeting summaries first for comprehensive participant interactions
- Then check individual transcripts for specific quotes
- Reference meeting dates and sources when available
- If no relevant conversation found, state clearly and suggest reasons

PLATFORM FEATURES (explain briefly if asked):
- Live meetings with real-time transcription and AI
- Meeting rooms with shared context and tasks
- AI summaries and action item extraction
- Historical meeting search and context
- Task creation with assignments and priorities
- Web search integration (@web command)

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

      // Add platform knowledge
      systemPrompt += `\n\nPLATFORM KNOWLEDGE:`;
      systemPrompt += `\nOhm is a video meeting platform with these key features:`;
      systemPrompt += `\n- Live video/audio meetings with real-time transcription and AI assistance`;
      systemPrompt += `\n- Meeting rooms that can be created, customized, and shared with participants`;
      systemPrompt += `\n- AI-powered meeting summaries, action items, and task management`;
      systemPrompt += `\n- Historical meeting context and searchable transcripts`;
      systemPrompt += `\n- Participant management and role assignments (hosts, participants)`;
      systemPrompt += `\n- Meeting scheduling with recurring patterns (daily, weekly, monthly, etc.)`;
      systemPrompt += `\n- Real-time chat and AI assistant during meetings`;
      systemPrompt += `\n- Task creation and assignment with priorities and due dates`;
      systemPrompt += `\n- Web search integration for real-time information (@web command)`;
      systemPrompt += `\n- Meeting types are customizable (Daily Standup, Client Review, Sprint Planning, etc.)`;
      systemPrompt += `\nUsers can ask about any of these features and you should explain them clearly.`;

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