import OpenAI from 'openai';
import { VectorService, ChatContext, MeetingTranscript } from './vector-service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIChatResponse {
  message: string;
  usedContext: boolean;
  relevantTranscripts: number;
}

export class AIChatbot {
  private static instance: AIChatbot;
  private vectorService: VectorService;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.vectorService = VectorService.getInstance();
  }

  static getInstance(): AIChatbot {
    if (!AIChatbot.instance) {
      AIChatbot.instance = new AIChatbot();
    }
    return AIChatbot.instance;
  }

  // System prompt for the AI assistant
  private getSystemPrompt(): string {
    return `You are Ohm, an AI assistant for video conferencing meetings. You help participants by:

1. Answering questions about the current meeting based on live transcripts
2. Providing insights from previous similar meetings using stored context
3. Summarizing discussions and key points
4. Helping with action items and follow-ups
5. Providing meeting-related assistance

Guidelines:
- Be concise but helpful
- Reference specific parts of transcripts when relevant
- Distinguish between current meeting content and historical context
- Use a professional but friendly tone
- If you don't have enough context, ask clarifying questions
- Always prioritize accuracy over speculation

When referencing transcripts, format them clearly and indicate if they're from the current meeting or previous meetings.`;
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

      // Get relevant context from vector database
      const context = await this.vectorService.getChatContext(
        message,
        roomName,
        currentTranscripts
      );

      // Prepare messages for OpenAI
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
      ];

      // Add context if available
      const formattedContext = this.formatContext(context);
      if (formattedContext.trim()) {
        messages.push({
          role: 'system',
          content: `CONTEXT INFORMATION:\n${formattedContext}`,
        });
      }

      // Add recent conversation history (last 10 messages)
      const recentHistory = history.slice(-10);
      messages.push(...recentHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })));

      // Get AI response
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

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
      };

    } catch (error) {
      console.error('Error processing AI chat:', error);
      return {
        message: 'I apologize, but I encountered an error. Please try again.',
        usedContext: false,
        relevantTranscripts: 0,
      };
    }
  }

  // Store meeting transcript for future context
  async storeMeetingTranscript(
    roomName: string,
    transcriptText: string,
    participants: string[]
  ): Promise<void> {
    if (!transcriptText.trim()) return;

    const transcript: Omit<MeetingTranscript, 'embedding'> = {
      id: `${roomName}-${Date.now()}`,
      roomName,
      content: transcriptText,
      timestamp: Date.now(),
      participants,
    };

    await this.vectorService.storeMeetingTranscript(transcript);
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