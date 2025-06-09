'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/client-utils';
import styles from '@/styles/CreateMeetingPopup.module.css';

interface CreateMeetingPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MeetingRoomForm {
  title: string;
  type: string;
  description: string;
  participants: string[];
}

const MEETING_TYPE_SUGGESTIONS = [
  'Daily Standup',
  'One-on-One',
  'Project Planning',
  'Client Review',
  'Sprint Retrospective',
  'Team Sync',
  'Design Review',
  'Product Demo'
];

export function CreateMeetingPopup({ isOpen, onClose }: CreateMeetingPopupProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'instant' | 'create'>('instant');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state for creating meeting room
  const [form, setForm] = useState<MeetingRoomForm>({
    title: '',
    type: '',
    description: '',
    participants: ['']
  });

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  if (!isOpen) return null;

  const handleInstantMeeting = () => {
    setIsLoading(true);
    const roomId = generateRoomId();
    router.push(`/rooms/${roomId}`);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.type.trim()) return;

    setIsLoading(true);
    
    try {
      // Filter out empty participants
      const validParticipants = form.participants.filter(p => p.trim());
      
      // Generate room ID from title (you can modify this logic)
      const roomId = form.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30) + '-' + Date.now().toString(36);

      // Create meeting room via API
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomId,
          title: form.title.trim(),
          type: form.type.trim(),
          isRecurring: true, // Meeting rooms are persistent/recurring
          description: form.description.trim() || undefined,
          participants: validParticipants
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create meeting room');
      }

      const data = await response.json();
      console.log('Meeting room created:', data);

      // Navigate to the meeting room
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error('Error creating meeting room:', error);
      alert('Failed to create meeting room. Please try again.');
      setIsLoading(false);
    }
  };

  const addParticipant = () => {
    setForm(prev => ({
      ...prev,
      participants: [...prev.participants, '']
    }));
  };

  const removeParticipant = (index: number) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }));
  };

  const updateParticipant = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.map((p, i) => i === index ? value : p)
    }));
  };

  const selectMeetingType = (type: string) => {
    setForm(prev => ({ ...prev, type }));
    setShowTypeDropdown(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Start Meeting</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'instant' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('instant')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
            Instant Meeting
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Create Meeting Room
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'instant' ? (
            <div className={styles.instantTab}>
              <div className={styles.instantIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                </svg>
              </div>
              <h3 className={styles.instantTitle}>Start Instant Meeting</h3>
              <p className={styles.instantDescription}>
                Create a quick video conference room that you can share with others
              </p>
              <button 
                onClick={handleInstantMeeting}
                disabled={isLoading}
                className={styles.primaryButton}
              >
                {isLoading ? 'Starting...' : 'Start Meeting Now'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateRoom} className={styles.createForm}>
              <div className={styles.formGroup}>
                <label htmlFor="title" className={styles.label}>
                  Meeting Room Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Weekly Team Standup"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="type" className={styles.label}>
                  Meeting Type *
                </label>
                <div className={styles.typeInputContainer}>
                  <input
                    id="type"
                    type="text"
                    value={form.type}
                    onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="Enter or select meeting type"
                    className={styles.input}
                    onFocus={() => setShowTypeDropdown(true)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className={styles.dropdownButton}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  {showTypeDropdown && (
                    <div className={styles.dropdown}>
                      {MEETING_TYPE_SUGGESTIONS.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => selectMeetingType(type)}
                          className={styles.dropdownItem}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description" className={styles.label}>
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the meeting room purpose"
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Participants
                </label>
                <div className={styles.participantsList}>
                  {form.participants.map((participant, index) => (
                    <div key={index} className={styles.participantRow}>
                      <input
                        type="email"
                        value={participant}
                        onChange={(e) => updateParticipant(index, e.target.value)}
                        placeholder="participant@example.com"
                        className={styles.input}
                      />
                      {form.participants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(index)}
                          className={styles.removeButton}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addParticipant}
                    className={styles.addButton}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Add Participant
                  </button>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={onClose}
                  className={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !form.title.trim() || !form.type.trim()}
                  className={styles.primaryButton}
                >
                  {isLoading ? 'Creating...' : 'Create Meeting Room'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 