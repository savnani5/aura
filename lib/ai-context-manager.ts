export interface AiChatMessage {
  id: string;
  type: 'user' | 'ai';
  message: string;
  timestamp: number;
  userName?: string;
  usedContext?: boolean;
  relevantTranscripts?: number;
  usedWebSearch?: boolean;
  citations?: string[];
}

export interface AiChatOptions {
  roomName: string;
  userName: string;
  currentTranscripts?: string;
  isLiveMeeting?: boolean;
}

export class AiContextManager {
  private static instance: AiContextManager;

  static getInstance(): AiContextManager {
    if (!AiContextManager.instance) {
      AiContextManager.instance = new AiContextManager();
    }
    return AiContextManager.instance;
  }

  /**
   * Send a message to the AI assistant
   */
  async sendAiMessage(
    message: string,
    options: AiChatOptions
  ): Promise<AiChatMessage> {
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          roomName: options.roomName,
          userName: options.userName,
          currentTranscripts: options.currentTranscripts,
          isLiveMeeting: options.isLiveMeeting || false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          id: `ai-response-${Date.now()}`,
          type: 'ai',
          message: data.response,
          timestamp: Date.now(),
          usedContext: data.usedContext,
          relevantTranscripts: data.relevantTranscripts,
          usedWebSearch: data.usedWebSearch,
          citations: data.citations,
        };
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending AI message:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send AI message');
    }
  }

  /**
   * Create a user message object
   */
  createUserMessage(
    message: string,
    userName: string
  ): AiChatMessage {
    return {
      id: `ai-user-${Date.now()}`,
      type: 'user',
      message: message,
      timestamp: Date.now(),
      userName: userName,
    };
  }

  /**
   * Create an error message object
   */
  createErrorMessage(error: string): AiChatMessage {
    return {
      id: `ai-error-${Date.now()}`,
      type: 'ai',
      message: `Error: ${error}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if a message is an AI command
   */
  isAiCommand(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return lowerMessage.startsWith('@ohm ') || lowerMessage.startsWith('@web ');
  }

  /**
   * Extract AI message from command
   */
  extractAiMessage(message: string): string {
    if (message.toLowerCase().startsWith('@ohm ')) {
      return message.slice(message.toLowerCase().indexOf('@ohm ') + 5);
    } else if (message.toLowerCase().startsWith('@web ')) {
      return message; // Keep @web prefix for backend processing
    }
    return message;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Get question suggestions based on context
   */
  getQuestionSuggestions(isLiveMeeting: boolean = false): string[] {
    const baseSuggestions = [
      "Summarize our room's previous discussions!",
      "What are the recurring topics in our meetings?",
      "Create a summary of action items!",
      "What decisions were made recently?"
    ];

    const liveSuggestions = [
      "Summarize what's been decided so far?",
      "What are the key topics covered in this meeting?",
      "What questions were raised but not answered?",
      "Who has been most active in the discussion?"
    ];

    // const webSuggestions = [
    //   "@web Who are our top 5 competitors in the market?"
    // ];

    if (isLiveMeeting) {
      return [...liveSuggestions];
    } else {
      return [...baseSuggestions];
    }
  }

  /**
   * Toggle AI command prefix
   */
  toggleAiPrefix(currentInput: string, prefix: '@ohm' | '@web'): string {
    const lowerInput = currentInput.toLowerCase();
    
    if (lowerInput.startsWith(`${prefix} `)) {
      // Remove the prefix if already present
      return currentInput.slice(prefix.length + 1);
    } else if (lowerInput.startsWith('@ohm ') && prefix === '@web') {
      // Replace @ohm with @web
      return `@web ${currentInput.slice(5)}`;
    } else if (lowerInput.startsWith('@web ') && prefix === '@ohm') {
      // Replace @web with @ohm
      return `@ohm ${currentInput.slice(5)}`;
    } else {
      // Add the prefix
      return `${prefix} ${currentInput}`;
    }
  }

  /**
   * Get placeholder text based on input
   */
  getPlaceholderText(input: string, isLiveMeeting: boolean = false): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.startsWith('@ohm ') || lowerInput.startsWith('@web ')) {
      return isLiveMeeting 
        ? "Ask AI about the meeting or search the web..."
        : "Ask AI about the room or search the web...";
    }
    
    return "Ask AI anything...";
  }
} 