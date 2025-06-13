'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/RoomChat.module.css';

interface AiChatMessage {
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

interface RoomChatProps {
  roomName: string;
  currentUser: string;
}

export default function RoomChat({ roomName, currentUser }: RoomChatProps) {
  const [aiChatHistory, setAiChatHistory] = useState<AiChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Question suggestions for AI
  const questionSuggestions = [
    "Summarize our room's previous discussions",
    "What are the recurring topics in our meetings?", 
    "Create a summary of action items",
    "What decisions were made recently?"
  ];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isAiProcessing) return;

    const messageText = newMessage.trim();
    
    // Process web search or send directly to AI
    let aiMessage = messageText;
    if (messageText.toLowerCase().startsWith('@web ')) {
      // Keep @web prefix for backend processing
      aiMessage = messageText;
    } else {
      // Send directly to AI without @ohm prefix
      aiMessage = messageText;
    }
    
    await handleAiChat(aiMessage);
    setNewMessage('');
  };

  const handleAiChat = async (message: string) => {
    if (!message.trim() || isAiProcessing) return;

    // Add user message to AI chat history
    const userChatId = `ai-user-${Date.now()}`;
    const userAiMessage: AiChatMessage = {
      id: userChatId,
      type: 'user',
      message: message,
      timestamp: Date.now(),
      userName: currentUser,
    };

    setAiChatHistory(prev => [...prev, userAiMessage]);
    setIsAiProcessing(true);

    try {
      // Get current transcripts (mock for now)
      const currentTranscripts = 'Mock transcript data for room context';

      // Send AI chat request
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          roomName,
          userName: currentUser,
          currentTranscripts,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add AI response to chat history
        const aiChatId = `ai-response-${Date.now()}`;
        const aiMessage: AiChatMessage = {
          id: aiChatId,
          type: 'ai',
          message: data.response,
          timestamp: Date.now(),
          usedContext: data.usedContext,
          relevantTranscripts: data.relevantTranscripts,
          usedWebSearch: data.usedWebSearch,
          citations: data.citations,
        };

        setAiChatHistory(prev => [...prev, aiMessage]);
      } else {
        // Handle error
        const errorMessage: AiChatMessage = {
          id: `ai-error-${Date.now()}`,
          type: 'ai',
          message: `Error: ${data.error || 'Failed to get AI response'}`,
          timestamp: Date.now(),
        };
        setAiChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending AI message:', error);
      const errorMessage: AiChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        message: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setAiChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const formatTimestamp = (timestamp: number) => {
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
  };

  return (
    <div className={styles.roomChat}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Ask Ohm</h3>
        <div className={styles.aiIndicator}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5z" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 22v-6" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="2"/>
          </svg>
          AI Assistant
        </div>
      </div>

      {/* Messages Container */}
      <div className={styles.messagesContainer}>
        <div className={styles.messagesList}>
          {aiChatHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Get insights about meetings, participants, and decisions.</p>
              
              <div className={styles.aiSuggestions} style={{ marginTop: '0.75rem' }}>
                <p className={styles.suggestionsTitle}>Popular questions:</p>
                <div className={styles.suggestionGrid}>
                  {questionSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className={styles.suggestionCard}
                      onClick={async () => {
                        await handleAiChat(suggestion);
                      }}
                      disabled={isAiProcessing}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Show compact suggestions at the top for any chat activity */}
              <div className={styles.aiSuggestionsCompact}>
                <p className={styles.suggestionsTitleCompact}>💡 Quick questions:</p>
                <div className={styles.suggestionButtonsCompact}>
                  {questionSuggestions.slice(0, 3).map((suggestion, index) => (
                    <button
                      key={index}
                      className={styles.suggestionButtonCompact}
                      onClick={async () => {
                        await handleAiChat(suggestion);
                      }}
                      disabled={isAiProcessing}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Chat Messages */}
              {aiChatHistory.map((aiMsg) => (
                <div
                  key={aiMsg.id}
                  className={`${styles.messageGroup} ${aiMsg.type === 'ai' ? styles.aiMessage : styles.userAiMessage}`}
                >
                  <div className={styles.messageHeader}>
                    <span className={styles.senderName}>
                      {aiMsg.type === 'ai' ? (
                        <span className={styles.aiSenderLabel}>
                          🤖 Ohm AI
                          {aiMsg.usedWebSearch && (
                            <span className={styles.webBadge}>
                              🌐 web
                            </span>
                          )}
                          {aiMsg.usedContext && (
                            <span className={styles.contextBadge}>
                              {aiMsg.relevantTranscripts ? `${aiMsg.relevantTranscripts} refs` : 'context'}
                            </span>
                          )}
                        </span>
                      ) : (
                        `${aiMsg.userName} → 🤖 AI`
                      )}
                    </span>
                    <span className={styles.timestamp}>
                      {formatTimestamp(aiMsg.timestamp)}
                    </span>
                  </div>
                  <div className={styles.messageText}>
                    <ReactMarkdown>{aiMsg.message}</ReactMarkdown>
                    {aiMsg.citations && aiMsg.citations.length > 0 && (
                      <div className={styles.citations}>
                        <p>Sources:</p>
                        {aiMsg.citations.map((citation, index) => (
                          <a key={index} href={citation} target="_blank" rel="noopener noreferrer" className={styles.citation}>
                            {citation}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* AI Processing Indicator */}
              {isAiProcessing && (
                <div className={`${styles.messageGroup} ${styles.aiMessage}`}>
                  <div className={styles.messageHeader}>
                    <span className={styles.senderName}>🤖 Ohm AI</span>
                    <span className={styles.timestamp}>Processing...</span>
                  </div>
                  <div className={styles.messageText}>
                    <div className={styles.aiProcessing}>
                      <span className={styles.typingIndicator}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className={styles.messageForm}>
        <div className={styles.commandButtons}>
          <button
            type="button"
            className={`${styles.commandButton} ${newMessage.toLowerCase().startsWith('@web ') ? styles.active : ''}`}
            onClick={() => {
              if (newMessage.toLowerCase().startsWith('@web ')) {
                // Remove @web prefix
                setNewMessage(newMessage.slice(5));
              } else {
                // Add @web prefix
                setNewMessage(`@web ${newMessage}`);
              }
            }}
            disabled={isAiProcessing}
            title="Web Search"
          >
            🌐 Web
          </button>
        </div>
        <div className={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              newMessage.toLowerCase().startsWith('@web ') 
                ? "Search the web..." 
                : "Ask Ohm anything about the room..."
            }
            className={styles.messageInput}
            rows={1}
            disabled={isAiProcessing}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isAiProcessing}
            className={styles.sendButton}
          >
            {isAiProcessing ? (
              <div className={styles.spinner} />
            ) : (
              '🤖'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 