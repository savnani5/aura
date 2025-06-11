import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from './mongodb';

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
  citations?: string[];
}

export class AIChatbot {
  private static instance: AIChatbot;
  private dbService: DatabaseService;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
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
- Task management and suggestions
- Rephrasing and clarity
- General meeting support

Be brief, direct, and helpful. When users ask about tasks or action items, you can suggest creating tasks with priorities and assignments.

Note: Meeting types are flexible - users can define any custom meeting type name (like "Daily Standup", "Client Review", "Sprint Planning", etc.).`;
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

  // Get meeting context for AI
  private async getMeetingContext(roomName: string): Promise<string> {
    try {
      const meeting = await this.dbService.getMeeting(roomName);
      if (!meeting) return '';

      let context = `Current meeting: ${meeting.title || meeting.type}\n`;
      
      if (meeting.participants.length > 0) {
        context += `Participants: ${meeting.participants.map(p => p.name).join(', ')}\n`;
      }

      if (meeting.tasks.length > 0) {
        context += `\nCurrent tasks:\n`;
        meeting.tasks.forEach(task => {
          context += `- ${task.title} (${task.status}${task.assigneeName ? `, assigned to ${task.assigneeName}` : ''})\n`;
        });
      }

      return context;
    } catch (error) {
      console.error('Error getting meeting context:', error);
      return '';
    }
  }

  // Process AI chat request
  async processChat(
    message: string,
    roomName: string,
    userName: string
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

      // Get meeting context
      const meetingContext = await this.getMeetingContext(roomName);

      // Prepare system prompt with context
      let systemPrompt = this.getSystemPrompt();
      
      // Add meeting context if available
      if (meetingContext.trim()) {
        systemPrompt += `\n\nCURRENT MEETING CONTEXT:\n${meetingContext}`;
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