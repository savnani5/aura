'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@livekit/components-react';

interface ControlBarChatProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ControlBarChat({ isOpen, onClose }: ControlBarChatProps) {
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
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline transition-colors"
          >
            {part}
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
    <>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-header-content">
          <div className="panel-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h3 className="panel-title">Chat</h3>
          {chatMessages.length > 0 && (
            <span className="message-count">
              {chatMessages.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="close-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="panel-messages" ref={chatMessagesRef}>
        {groupedChatMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <p>No messages yet. Start a conversation with other participants!</p>
          </div>
        ) : (
          <div className="messages-list">
            {groupedChatMessages.map((group) => (
              <div key={group.groupId} className="message-group">
                <div className="message-header">
                  <span className="sender-name">
                    {group.senderName}
                  </span>
                  <span className="message-time">
                    {formatTimestamp(group.latestTimestamp)}
                  </span>
                </div>
                <div className="message-content">
                  {group.messages.map((msg) => (
                    <div key={msg.id} className="message-text">
                      {makeLinksClickable(msg.text)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="panel-input">
        <form onSubmit={handleChatSubmit} className="input-form">
          <div className="input-row">
            <input
              type="text"
              className="message-input"
              placeholder="Message to participants..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isSending}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isSending || !chatInput.trim()}
            >
              {isSending ? (
                <div className="spinner"></div>
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
    </>
  );
} 