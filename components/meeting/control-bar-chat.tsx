'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@livekit/components-react';
import { Send, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ControlBarChatProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessage?: () => void;
}

interface GroupedChatMessage {
  senderId: string;
  senderName: string;
  messages: Array<{
    id: string;
    text: string;
    timestamp: number;
  }>;
  latestTimestamp: number;
  groupId: string;
}

export function ControlBarChat({ isOpen, onClose, onNewMessage }: ControlBarChatProps) {
  const { chatMessages, send: sendMessage, isSending } = useChat();
  const [chatInput, setChatInput] = useState('');
  const [groupedChatMessages, setGroupedChatMessages] = useState<GroupedChatMessage[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Group chat messages by consecutive sender
  useEffect(() => {
    const grouped: GroupedChatMessage[] = [];
    
    chatMessages.forEach((message) => {
      const lastGroup = grouped[grouped.length - 1];
      const senderId = message.from?.identity || message.from?.name || 'Unknown';
      const senderName = message.from?.name || message.from?.identity || 'Unknown';
      
      if (lastGroup && lastGroup.senderId === senderId) {
        lastGroup.messages.push({
          id: message.id,
          text: message.message,
          timestamp: message.timestamp
        });
        lastGroup.latestTimestamp = Math.max(lastGroup.latestTimestamp, message.timestamp);
      } else {
        grouped.push({
          senderId: senderId,
          senderName: senderName,
          messages: [{
            id: message.id,
            text: message.message,
            timestamp: message.timestamp
          }],
          latestTimestamp: message.timestamp,
          groupId: `${senderId}-${message.timestamp}-${Math.random()}`
        });
      }
    });
    
    setGroupedChatMessages(grouped);
  }, [chatMessages]);

  // Detect new messages and notify parent when chat is closed
  const prevMessageCountRef = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMessageCountRef.current && !isOpen && onNewMessage) {
      onNewMessage();
    }
    prevMessageCountRef.current = chatMessages.length;
  }, [chatMessages.length, isOpen, onNewMessage]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [groupedChatMessages]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const makeLinksClickable = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        // Truncate very long URLs for display
        const displayUrl = part.length > 50 ? part.substring(0, 47) + '...' : part;
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline transition-colors break-all inline-block max-w-full"
            title={part} // Show full URL on hover
          >
            {displayUrl}
          </a>
        );
      }
      return part;
    });
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    await sendMessage(chatInput);
    setChatInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] text-white border-l border-[rgba(55,65,81,0.3)] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgba(55,65,81,0.3)]">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-gray-400" />
          <h3 className="font-medium text-white">Chat</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X size={18} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={chatMessagesRef}>
        {groupedChatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-400 text-sm">No messages yet. Start a conversation with other participants!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedChatMessages.map((group) => {
              const isCurrentUser = group.senderName === 'You';
              return (
                <div key={group.groupId} className={cn(
                  "flex",
                  isCurrentUser ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[80%] space-y-1",
                    isCurrentUser ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "text-xs font-medium mb-1",
                      isCurrentUser ? "text-right text-gray-400" : "text-left text-gray-400"
                    )}>
                      {group.senderName} • {formatTimestamp(group.latestTimestamp)}
                    </div>
                    <div className={cn(
                      "rounded-lg px-4 py-2 break-words",
                      isCurrentUser 
                        ? "bg-blue-600 text-white" 
                        : "bg-[#2a2a2a] text-white"
                    )}>
                      <div className="space-y-1">
                        {group.messages.map((msg) => (
                          <div key={msg.id} className="text-sm break-words overflow-wrap-anywhere">
                            {makeLinksClickable(msg.text)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[rgba(55,65,81,0.3)]">
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-[#374151] rounded-lg text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            placeholder="Message to participants..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
              disabled={isSending}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isSending || !chatInput.trim()}
            className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
} 