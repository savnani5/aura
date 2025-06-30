'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/RoomChat.module.css';
import { AiContextManager, AiChatMessage } from '@/lib/ai-context-manager';

interface RoomChatProps {
  roomName: string;
  currentUser: string;
  currentTranscripts?: string;
  isLiveMeeting?: boolean;
}

export default function RoomChat({ 
  roomName, 
  currentUser, 
  currentTranscripts, 
  isLiveMeeting = false 
}: RoomChatProps) {
  const [aiChatHistory, setAiChatHistory] = useState<AiChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiContextManager = AiContextManager.getInstance();

  // Question suggestions for AI - context-aware based on live vs offline
  const questionSuggestions = aiContextManager.getQuestionSuggestions(isLiveMeeting);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isAiProcessing) return;

    const messageText = newMessage.trim();
    await handleAiChat(messageText);
    setNewMessage('');
  };

  const handleAiChat = async (message: string) => {
    if (!message.trim() || isAiProcessing) return;

    // Create user message
    const userMessage = aiContextManager.createUserMessage(message, currentUser);
    setAiChatHistory(prev => [...prev, userMessage]);
    setIsAiProcessing(true);

    try {
      // Send message using AiContextManager
      const aiResponse = await aiContextManager.sendAiMessage(message, {
        roomName,
        userName: currentUser,
        currentTranscripts,
        isLiveMeeting,
      });

      setAiChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error sending AI message:', error);
      const errorMessage = aiContextManager.createErrorMessage(
        error instanceof Error ? error.message : 'Failed to send message'
      );
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
    return aiContextManager.formatTimestamp(timestamp);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const toggleSources = (messageId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedSources(newExpanded);
  };

  return (
    <div className={styles.roomChat}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Ask AI
          {isLiveMeeting && (
            <span className={styles.liveBadge}>
              🔴 Live
            </span>
          )}
        </h3>
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
              <p>
                {isLiveMeeting 
                  ? "Get real-time insights about this meeting and past discussions."
                  : "Get insights about meetings, participants, and decisions."
                }
              </p>
              
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
                              🌐 search web
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
                    {aiMsg.type === 'ai' ? (
                      <button
                        onClick={() => copyToClipboard(aiMsg.message)}
                        className={styles.copyIconButton}
                        title="Copy response"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </button>
                    ) : (
                      <span className={styles.timestamp}>
                        {formatTimestamp(aiMsg.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className={styles.messageText}>
                    <ReactMarkdown>{aiMsg.message}</ReactMarkdown>
                    
                    {/* Copy Button and Sources for AI messages */}
                    {aiMsg.type === 'ai' && (
                      <div className={styles.messageActions}>
                        <button
                          onClick={() => copyToClipboard(aiMsg.message)}
                          className={styles.copyButton}
                          title="Copy response"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Copy
                        </button>
                        
                        {aiMsg.citations && aiMsg.citations.length > 0 && (
                          <button
                            onClick={() => toggleSources(aiMsg.id)}
                            className={styles.sourcesToggle}
                            title="Toggle sources"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" stroke="currentColor" strokeWidth="2"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            Sources ({aiMsg.citations.length})
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              className={`${styles.chevron} ${expandedSources.has(aiMsg.id) ? styles.expanded : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Collapsible Sources */}
                    {aiMsg.citations && aiMsg.citations.length > 0 && expandedSources.has(aiMsg.id) && (
                      <div className={styles.citations}>
                        {aiMsg.citations.map((citation, index) => (
                          <a key={index} href={citation} target="_blank" rel="noopener noreferrer" className={styles.citation}>
                            🔗 {new URL(citation).hostname}
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
              setNewMessage(aiContextManager.toggleAiPrefix(newMessage, '@web'));
            }}
            disabled={isAiProcessing}
            title="Search Web"
          >
            🌐 search web
          </button>
        </div>
        <div className={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={aiContextManager.getPlaceholderText(newMessage, isLiveMeeting)}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="m5 12 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="m12 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 