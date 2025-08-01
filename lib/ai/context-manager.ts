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
   * Send a message to the AI assistant with streaming support
   */
  async sendAiMessage(
    message: string,
    options: AiChatOptions,
    onChunk?: (chunk: any) => void
  ): Promise<AiChatMessage> {
    try {
      if (onChunk) {
        // Use streaming endpoint
        return await this.sendAiMessageStream(message, options, onChunk);
      } else {
        // Use regular endpoint for backward compatibility
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
      }
    } catch (error) {
      console.error('Error sending AI message:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send AI message');
    }
  }

  /**
   * Send a message to the AI assistant with streaming
   */
  private async sendAiMessageStream(
    message: string,
    options: AiChatOptions,
    onChunk: (chunk: any) => void
  ): Promise<AiChatMessage> {
    const response = await fetch('/api/ai-chat/stream', {
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedMessage = '';
    let finalMetadata = {};

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              onChunk(parsed);

              if (parsed.type === 'context') {
                finalMetadata = {
                  ...finalMetadata,
                  usedContext: parsed.usedContext,
                  relevantTranscripts: parsed.relevantTranscripts,
                  queryType: parsed.queryType,
                  confidence: parsed.confidence
                };
              } else if (parsed.type === 'text') {
                accumulatedMessage += parsed.content;
              } else if (parsed.type === 'complete') {
                finalMetadata = {
                  ...finalMetadata,
                  usedWebSearch: parsed.usedWebSearch,
                  citations: parsed.citations
                };
                accumulatedMessage = parsed.content;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError);
            }
          }
        }
      }
    }

    return {
      id: `ai-response-${Date.now()}`,
      type: 'ai',
      message: accumulatedMessage,
      timestamp: Date.now(),
      ...finalMetadata
    };
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
    return lowerMessage.startsWith('@aura ') || lowerMessage.startsWith('@web ');
  }

  /**
   * Extract AI message from command
   */
  extractAiMessage(message: string): string {
    if (message.toLowerCase().startsWith('@aura ')) {
      return message.slice(message.toLowerCase().indexOf('@aura ') + 6);
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
  getQuestionSuggestions(isLiveMeeting: boolean = false): Array<{ display: string; query: string }> {
    const baseSuggestions = [
      {
        display: "Previous discussions",
        query: "Based on our meeting transcripts, summarize our room's previous discussions"
      },
      {
        display: "Top customer issues",
        query: "What are the top customer issues mentioned in our meetings?"
      },
      {
        display: "Action items summary",
        query: "From our meeting history, create a summary of action items"
      },
      {
        display: "Recent decisions",
        query: "What decisions were made in our recent meetings?"
      }
    ];

    const liveSuggestions = [
      {
        display: "What's decided so far",
        query: "Based on this meeting transcript, summarize what's been decided so far"
      },
      {
        display: "Key topics covered",
        query: "From our current meeting, what are the key topics covered?"
      },
      {
        display: "Unanswered questions",
        query: "Looking at our meeting discussion, what questions were raised but not answered?"
      },
      {
        display: "Most active speaker",
        query: "Based on the transcript, who has been most active in the discussion?"
      }
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
  toggleAiPrefix(currentInput: string, prefix: '@aura' | '@web'): string {
    const lowerInput = currentInput.toLowerCase();
    
    if (lowerInput.startsWith(`${prefix} `)) {
      // Remove the prefix if already present
      return currentInput.slice(prefix.length + 1);
    } else if (lowerInput.startsWith('@aura ') && prefix === '@web') {
      // Replace @aura with @web
      return `@web ${currentInput.slice(5)}`;
    } else if (lowerInput.startsWith('@web ') && prefix === '@aura') {
      // Replace @web with @aura
      return `@aura ${currentInput.slice(5)}`;
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
    
    if (lowerInput.startsWith('@aura ') || lowerInput.startsWith('@web ')) {
      return isLiveMeeting 
        ? "Ask AI about the meeting or search the web..."
        : "Ask AI about the room or search the web...";
    }
    
    return "Ask AI anything...";
  }
} 