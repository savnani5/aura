'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Sparkles, Copy, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { AiContextManager } from '@/lib/ai/context-manager';

interface Workspace {
  id: string;
  name: string;
  type: string;
  description?: string;
  participantCount: number;
  lastActivity: string;
  recentMeetings: number;
  isActive: boolean;
}

interface AiChatPanelProps {
  workspace: Workspace | null;
  onClose: () => void;
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

export function AiChatPanel({ workspace, onClose }: AiChatPanelProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const aiContextManager = new AiContextManager();

  // Get question suggestions from AiContextManager
  const questionSuggestions = aiContextManager.getQuestionSuggestions(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Clear chat history when workspace changes
  useEffect(() => {
    if (workspace?.id && currentWorkspaceId && workspace.id !== currentWorkspaceId) {
      console.log('🔄 Workspace changed, clearing chat history:', {
        previous: currentWorkspaceId,
        current: workspace.id
      });
      setChatHistory([]);
      setCurrentAiMessage('');
      setChatInput('');
      setIsProcessing(false);
      setExpandedSources(new Set());
      setCopiedMessageId(null);
    }
    if (workspace?.id) {
      setCurrentWorkspaceId(workspace.id);
    }
  }, [workspace?.id, currentWorkspaceId]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isProcessing) return;

    const message = chatInput.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message,
      timestamp: Date.now(),
      userName: 'You'
    };

    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsProcessing(true);
    setCurrentAiMessage('');

    try {
      let accumulatedMessage = '';
      let finalMetadata = {};

      console.log('🎯 Sending AI message (handleSendMessage):', {
        message,
        roomName: workspace?.id || 'workspace',
        workspace: workspace?.name
      });

      const aiMessage = await aiContextManager.sendAiMessage(
        message,
        {
          roomName: workspace?.id || 'workspace',
          userName: 'You',
          isLiveMeeting: false
        },
        (chunk) => {
          if (chunk.type === 'text') {
            accumulatedMessage += chunk.content;
            setCurrentAiMessage(accumulatedMessage);
          } else if (chunk.type === 'context') {
            console.log('📋 Context retrieved (handleSendMessage):', {
              usedContext: chunk.usedContext,
              relevantTranscripts: chunk.relevantTranscripts
            });
            finalMetadata = {
              ...finalMetadata,
              usedContext: chunk.usedContext,
              relevantTranscripts: chunk.relevantTranscripts
            };
          } else if (chunk.type === 'complete') {
            finalMetadata = {
              ...finalMetadata,
              usedWebSearch: chunk.usedWebSearch,
              citations: chunk.citations
            };
            accumulatedMessage = chunk.content;
          }
        }
      );

      const finalAiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        message: accumulatedMessage || aiMessage.message,
        timestamp: Date.now(),
        ...finalMetadata
      };

      setChatHistory(prev => [...prev, finalAiMessage]);
      setCurrentAiMessage('');
    } catch (error) {
      console.error('Error sending AI chat message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      };

      setChatHistory(prev => [...prev, errorMessage]);
      setCurrentAiMessage('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = async (suggestion: { display: string; query: string }) => {
    if (isProcessing) return;
    
    const message = suggestion.query;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message,
      timestamp: Date.now(),
      userName: 'You'
    };

         setChatHistory(prev => [...prev, userMessage]);
     setIsProcessing(true);
     setCurrentAiMessage('');

     try {
       let accumulatedMessage = '';
       let finalMetadata = {};

       console.log('🎯 Sending AI message (handleSuggestionClick):', {
         message,
         roomName: workspace?.id || 'workspace',
         workspace: workspace?.name
       });

              const aiMessage = await aiContextManager.sendAiMessage(
         message,
         {
           roomName: workspace?.id || 'workspace',
           userName: 'You',
           isLiveMeeting: false
         },
         (chunk) => {
           if (chunk.type === 'text') {
             accumulatedMessage += chunk.content;
             setCurrentAiMessage(accumulatedMessage);
           } else if (chunk.type === 'context') {
             console.log('📋 Context retrieved (handleSuggestionClick):', {
               usedContext: chunk.usedContext,
               relevantTranscripts: chunk.relevantTranscripts
             });
             finalMetadata = {
               ...finalMetadata,
               usedContext: chunk.usedContext,
               relevantTranscripts: chunk.relevantTranscripts
             };
          } else if (chunk.type === 'complete') {
            finalMetadata = {
              ...finalMetadata,
              usedWebSearch: chunk.usedWebSearch,
              citations: chunk.citations
            };
            accumulatedMessage = chunk.content;
          }
        }
      );

      const finalAiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        message: accumulatedMessage || aiMessage.message,
        timestamp: Date.now(),
        ...finalMetadata
      };

      setChatHistory(prev => [...prev, finalAiMessage]);
      setCurrentAiMessage('');
    } catch (error) {
      console.error('Error sending AI chat message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      };

      setChatHistory(prev => [...prev, errorMessage]);
      setCurrentAiMessage('');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSourceExpansion = (messageId: string) => {
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

  const copyMessage = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  return (
    <div className="fixed right-6 top-6 bottom-6 w-96 bg-card rounded-lg shadow-2xl border border-border z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="font-medium text-foreground">AI Assistant</h3>
                {workspace && (
                  <p className="text-sm text-muted-foreground">{workspace.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setChatHistory([]);
                  setChatInput('');
                  setCurrentAiMessage('');
                }}
                title="New Chat"
              >
                <Plus size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <div 
            ref={chatMessagesRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
          >
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-muted-foreground" />
                </div>
                <h4 className="font-medium text-foreground mb-2">
                  AI Assistant for {workspace?.name || 'Workspace'}
                </h4>
                <p className="text-sm text-muted-foreground mb-6">
                  Ask me anything about your meetings, participants, or workspace insights.
                </p>
                
                {/* Suggestions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Try asking:</p>
                  {questionSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left p-3 text-sm text-foreground bg-muted hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                      disabled={isProcessing}
                    >
                      {suggestion.display}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {chatHistory.map((message) => (
                  <div key={message.id} className="group">
                    <div
                      className={cn(
                        "rounded-lg p-3 max-w-[85%] relative",
                        message.type === 'user' 
                          ? "bg-primary text-primary-foreground ml-auto" 
                          : "bg-muted text-foreground"
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
                            onClick={() => copyMessage(message.id, message.message)}
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
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>
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
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                              📋 Context ({message.relevantTranscripts || 0})
                            </span>
                          )}
                          {message.usedWebSearch && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                              🌐 Web
                            </span>
                          )}
                        </div>
                        
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleSourceExpansion(message.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              Sources ({message.citations.length})
                              <span className={expandedSources.has(message.id) ? 'rotate-180' : ''}>
                                ▼
                              </span>
                            </button>
                            {expandedSources.has(message.id) && (
                              <div className="mt-1 space-y-1">
                                {message.citations.map((citation, idx) => (
                                  <div key={idx} className="text-xs text-blue-600 hover:text-blue-800">
                                    {citation}
                                  </div>
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
                  const lastMessage = chatHistory[chatHistory.length - 1];
                  const showSuggestions = lastMessage && lastMessage.type === 'ai' && !isProcessing;
                  
                  return showSuggestions && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ask me more:</p>
                      {questionSuggestions.slice(0, 3).map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full text-left p-2 text-xs text-foreground bg-muted/50 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                          disabled={isProcessing}
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
            {isProcessing && currentAiMessage && (
              <div className="bg-muted text-foreground rounded-lg p-3 max-w-[85%]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium">AI Assistant</span>
                </div>
                                 <div className="text-sm prose prose-sm max-w-none">
                   <ReactMarkdown>
                     {currentAiMessage}
                   </ReactMarkdown>
                   <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1"></span>
                 </div>
              </div>
            )}
            
            {/* Thinking indicator */}
            {isProcessing && !currentAiMessage && (
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

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={aiContextManager.getPlaceholderText(chatInput, false)}
                className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                disabled={isProcessing}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isProcessing}
                size="icon"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
} 