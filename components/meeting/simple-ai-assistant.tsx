'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import ReactMarkdown from 'react-markdown';
import { useUser, SignUpButton } from '@clerk/nextjs';
import { 
  Bot, 
  X, 
  Send, 
  Copy, 
  ChevronDown,
  Plus,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SimpleAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentTranscripts?: string; // Pass current transcripts from parent
}

interface ChatMessage {
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

export function SimpleAIAssistant({ isOpen, onClose, currentTranscripts }: SimpleAIAssistantProps) {
  const { user, isLoaded } = useUser();
  const room = useRoomContext();
  const [isMobile, setIsMobile] = useState(false);

  // Check if user is a guest (not authenticated)
  const isGuest = !isLoaded || !user;

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // AI Chat functionality
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Refs for auto-scrolling with user control
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Question suggestions for AI chat
  const questionSuggestions = [
    {
      display: "Summarize past 5 mins",
      query: "Can you summarize what has been discussed in the past 5 minutes of our meeting?"
    },
    {
      display: "Last meeting recap",
      query: "What was discussed in our last meeting and how does it relate to today's discussion?"
    },
    {
      display: "What to ask next?",
      query: "Based on what has been discussed so far, what should I ask next to move the conversation forward?"
    },
    {
      display: "Key decisions made",
      query: "What are the key decisions that have been made during this meeting?"
    }
  ];

  // Smart auto-scroll: only scroll if user hasn't manually scrolled up
  useEffect(() => {
    if (chatMessagesRef.current && shouldAutoScroll && !userHasScrolled) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [aiChatHistory, currentAiMessage, shouldAutoScroll, userHasScrolled]);

  // Handle user scroll detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isScrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50; // 50px threshold
    
    if (isScrolledToBottom) {
      setUserHasScrolled(false);
      setShouldAutoScroll(true);
    } else {
      setUserHasScrolled(true);
      setShouldAutoScroll(false);
    }
  };

  // Reset scroll state when starting new AI response
  useEffect(() => {
    if (isAiProcessing && currentAiMessage === '') {
      setUserHasScrolled(false);
      setShouldAutoScroll(true);
    }
  }, [isAiProcessing, currentAiMessage]);

  const copyToClipboard = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const clearChat = () => {
    setAiChatHistory([]);
    setAiChatInput('');
    setCurrentAiMessage('');
    setIsAiProcessing(false);
    setExpandedSources(new Set());
    setCopiedMessageId(null);
  };

  // AI chat submit
  const handleAiChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiChatInput.trim() || isAiProcessing) return;

    const messageText = aiChatInput.trim();
    await handleAiChat(messageText);
    setAiChatInput('');
  };

  const handleAiChat = async (message: string) => {
    if (!message.trim() || isAiProcessing) return;

    const currentUser = room?.localParticipant?.name || room?.localParticipant?.identity || 'User';
    const roomName = room?.name || 'unknown';

    const userChatId = `ai-user-${Date.now()}`;
    const userAiMessage: ChatMessage = {
      id: userChatId,
      type: 'user',
      message: message,
      timestamp: Date.now(),
      userName: currentUser,
    };

    setAiChatHistory(prev => [...prev, userAiMessage]);
    setIsAiProcessing(true);
    setCurrentAiMessage('');

    const aiChatId = `ai-response-${Date.now()}`;

    try {
                        const response = await fetch('/api/ai-chat/stream', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      message,
                      roomName,
                      userName: currentUser,
                      currentTranscripts: currentTranscripts || '', // Pass current transcripts from parent
                      isLiveMeeting: true,
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

                if (parsed.type === 'metadata') {
                  console.log('📊 AI processing metadata:', parsed);
                } else if (parsed.type === 'context') {
                  console.log('📋 AI context:', parsed);
                  finalMetadata = {
                    ...finalMetadata,
                    usedContext: parsed.usedContext,
                    relevantTranscripts: parsed.relevantTranscripts,
                  };
                } else if (parsed.type === 'retry') {
                  console.log(`🔄 Retrying with ${parsed.nextModel} (attempt ${parsed.attempt}/${parsed.totalAttempts})`);
                  setCurrentAiMessage(`🔄 Switching to backup AI model... (attempt ${parsed.attempt}/${parsed.totalAttempts})`);
                } else if (parsed.type === 'text') {
                  accumulatedMessage += parsed.content;
                  setCurrentAiMessage(accumulatedMessage);
                } else if (parsed.type === 'complete') {
                  finalMetadata = {
                    ...finalMetadata,
                    usedWebSearch: parsed.usedWebSearch,
                    citations: parsed.citations
                  };
                  accumulatedMessage = parsed.content;
                  setCurrentAiMessage(accumulatedMessage);
                } else if (parsed.type === 'error') {
                  const errorMessage = parsed.message || parsed.error || 'Unknown error';
                  throw new Error(errorMessage);
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      }

      // Add final AI message to history
      const finalAiMessage: ChatMessage = {
        id: aiChatId,
        type: 'ai',
        message: accumulatedMessage,
        timestamp: Date.now(),
        ...finalMetadata
      };

      setAiChatHistory(prev => [...prev, finalAiMessage]);
      setCurrentAiMessage('');
    } catch (error) {
      console.error('Error sending AI chat:', error);
      
      const errorMessage: ChatMessage = {
        id: aiChatId,
        type: 'ai',
        message: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };

      setAiChatHistory(prev => [...prev, errorMessage]);
      setCurrentAiMessage('');
    } finally {
      setIsAiProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "h-full flex flex-col bg-[#1a1a1a] text-white shadow-lg",
      !isMobile && "border-l border-[rgba(55,65,81,0.3)]"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-[rgba(55,65,81,0.3)]",
        isMobile ? "p-3" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "bg-blue-600 text-white rounded-lg flex items-center justify-center",
            isMobile ? "w-7 h-7" : "w-8 h-8"
          )}>
            <Bot size={isMobile ? 14 : 16} />
          </div>
          <div>
            <h3 className={cn(
              "font-medium text-white",
              isMobile && "text-sm"
            )}>AI Assistant</h3>
            <p className={cn(
              "text-gray-400",
              isMobile ? "text-xs" : "text-sm"
            )}>Meeting insights & chat</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            title="New Chat"
            className={cn(
              "text-gray-400 hover:text-white hover:bg-white/10",
              isMobile ? "h-7 w-7" : "h-8 w-8"
            )}
          >
            <Plus size={isMobile ? 14 : 16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              "text-gray-400 hover:text-white hover:bg-white/10",
              isMobile ? "h-7 w-7" : "h-8 w-8"
            )}
          >
            <X size={isMobile ? 14 : 16} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Messages */}
        <div 
          ref={chatMessagesRef}
          onScroll={handleScroll}
          className={cn(
            "flex-1 overflow-y-auto space-y-4 custom-scrollbar",
            isMobile ? "p-3" : "p-4"
          )}
        >
          {aiChatHistory.length === 0 ? (
            <div className="text-center py-8">
              {isGuest ? (
                /* Guest Signup Prompt */
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4">
                    <Bot size={24} className="text-gray-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">AI Assistant</h4>
                  <p className="text-gray-400 text-sm mb-6 max-w-sm">
                    Sign up for free to access AI-powered meeting insights, summaries, and chat with your meeting data.
                  </p>
                  <div className="space-y-3">
                    <SignUpButton mode="modal">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Sign Up for Free
                      </Button>
                    </SignUpButton>
                    <p className="text-xs text-gray-500">
                      ✨ Get meeting summaries, action items, and AI chat
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bot size={24} className="text-gray-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">
                    AI Assistant for Meeting
                  </h4>
                  <p className="text-sm text-gray-400 mb-6">
                    Ask me anything about the meeting, participants, or search the web.
                  </p>
                  
                  {/* Suggestions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-300 mb-3">Try asking:</p>
                    {questionSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleAiChat(suggestion.query)}
                        className="w-full text-left p-3 text-sm text-white bg-[#2a2a2a] hover:bg-[#374151] rounded-lg transition-colors"
                        disabled={isAiProcessing}
                      >
                        {suggestion.display}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {aiChatHistory.map((message) => (
                <div key={message.id} className="group">
                                      <div
                      className={cn(
                        "rounded-lg relative",
                        isMobile ? "p-2 max-w-[90%] text-sm" : "p-3 max-w-[85%]",
                        message.type === 'user' 
                          ? "bg-blue-600 text-white ml-auto" 
                          : "bg-[#2a2a2a] text-white border border-[#374151]"
                      )}
                    >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {message.type === 'user' ? message.userName : 'AI Assistant'}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      {message.type === 'ai' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(message.id, message.message)}
                          title="Copy response"
                        >
                          {copiedMessageId === message.id ? (
                            <Check size={12} className="text-green-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </Button>
                      )}
                    </div>
                  
                                            <div className="text-sm">
                          {message.type === 'ai' ? (
                            <div className="prose prose-sm max-w-none prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-gray-300 prose-code:bg-[#374151] prose-code:text-white prose-pre:bg-black prose-li:text-white prose-ul:text-white prose-ol:text-white">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 text-white leading-relaxed">{children}</p>,
                                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-white space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-white space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-white">{children}</li>,
                                  code: ({ children }) => <code className="bg-[#374151] px-1.5 py-0.5 rounded text-sm text-white font-mono">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-black p-3 rounded-lg overflow-x-auto mb-2">{children}</pre>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
                                }}
                              >
                                {message.message}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            message.message
                          )}
                        </div>

                    {/* Context indicators for AI messages */}
                    {message.type === 'ai' && (message.usedContext || message.usedWebSearch) && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex flex-wrap gap-1">
                          {message.usedContext && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              📋 Context ({message.relevantTranscripts || 0})
                            </span>
                          )}
                          {message.usedWebSearch && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              🌐 Web
                            </span>
                          )}
                        </div>
                        
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleSources(message.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              Sources ({message.citations.length})
                              <ChevronDown size={12} className={cn(
                                "transition-transform",
                                expandedSources.has(message.id) && "rotate-180"
                              )} />
                            </button>
                            {expandedSources.has(message.id) && (
                              <div className="mt-1 space-y-1">
                                {message.citations.map((citation, idx) => (
                                  <a
                                    key={idx}
                                    href={citation}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate"
                                  >
                                    {citation}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Show suggestions after the last AI message */}
              {(() => {
                const lastMessage = aiChatHistory[aiChatHistory.length - 1];
                const showSuggestions = lastMessage && lastMessage.type === 'ai' && !isAiProcessing;
                
                return showSuggestions && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Ask me more:</p>
                    {questionSuggestions.slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleAiChat(suggestion.query)}
                        className="w-full text-left p-2 text-xs text-foreground bg-muted/50 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                        disabled={isAiProcessing}
                      >
                        {suggestion.display}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
          
                              {/* Streaming AI response */}
                    {isAiProcessing && currentAiMessage && (
                      <div className="bg-[#2a2a2a] text-white border border-[#374151] rounded-lg p-3 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium">AI Assistant</span>
                        </div>
                        <div className="text-sm prose prose-sm max-w-none prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-gray-300 prose-code:bg-[#374151] prose-code:text-white prose-pre:bg-black prose-li:text-white prose-ul:text-white prose-ol:text-white">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 text-white leading-relaxed">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-white space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-white space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-white">{children}</li>,
                              code: ({ children }) => <code className="bg-[#374151] px-1.5 py-0.5 rounded text-sm text-white font-mono">{children}</code>,
                              pre: ({ children }) => <pre className="bg-black p-3 rounded-lg overflow-x-auto mb-2">{children}</pre>,
                              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
                            }}
                          >
                            {currentAiMessage}
                          </ReactMarkdown>
                          <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></span>
                        </div>
                      </div>
                    )}
          
          {/* Thinking indicator */}
          {isAiProcessing && !currentAiMessage && (
            <div className="bg-muted text-foreground rounded-lg p-3 max-w-[85%]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">AI Assistant</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground italic">Thinking</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

                  {/* Input Area - Only show for authenticated users */}
          {!isGuest && (
            <div className={cn(
              "border-t border-[rgba(55,65,81,0.3)]",
              isMobile ? "p-3" : "p-4"
            )}>
              <div className="flex gap-2 items-end">
                <textarea
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiChatSubmit(e);
                    }
                  }}
                  placeholder="Ask AI about the meeting... (Shift+Enter for new line)"
                  rows={1}
                  className={cn(
                    "flex-1 bg-[#2a2a2a] border border-[#374151] rounded-md text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none overflow-hidden",
                    isMobile ? "px-2 py-2 text-sm" : "px-3 py-2 text-sm"
                  )}
                  style={{
                    minHeight: isMobile ? '36px' : '40px',
                    maxHeight: '120px'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                  disabled={isAiProcessing}
                />
                <Button
                  onClick={handleAiChatSubmit}
                  disabled={!aiChatInput.trim() || isAiProcessing}
                  size="icon"
                  className={cn(
                    "bg-blue-600 hover:bg-blue-700 text-white shrink-0",
                    isMobile ? "h-9 w-9" : "h-10 w-10"
                  )}
                >
                  <Send size={isMobile ? 14 : 16} />
                </Button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
} 