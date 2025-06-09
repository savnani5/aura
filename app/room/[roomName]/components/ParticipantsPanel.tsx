'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/styles/ParticipantsPanel.module.css';

interface Participant {
  id: string;
  name: string;
  email?: string;
  isOnline: boolean;
  lastSeen?: string;
  joinedAt: string;
  role: 'host' | 'member';
}

interface ParticipantsPanelProps {
  roomName: string;
}

export function ParticipantsPanel({ roomName }: ParticipantsPanelProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const response = await fetch(`/api/meetings/${roomName}/participants`);
        if (response.ok) {
          const data = await response.json();
          setParticipants(data);
        }
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [roomName]);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;

    try {
      const response = await fetch(`/api/meetings/${roomName}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newParticipantName.trim(),
          email: newParticipantEmail.trim() || undefined,
        }),
      });

      if (response.ok) {
        const newParticipant = await response.json();
        setParticipants(prev => [...prev, newParticipant]);
        setNewParticipantName('');
        setNewParticipantEmail('');
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Error adding participant:', error);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      const response = await fetch(`/api/meetings/${roomName}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });

      if (response.ok) {
        setParticipants(prev => prev.filter(p => p.id !== participantId));
      }
    } catch (error) {
      console.error('Error removing participant:', error);
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    const diffHours = Math.ceil(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.ceil(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading participants...</p>
        </div>
      </div>
    );
  }

  const onlineParticipants = participants.filter(p => p.isOnline);
  const offlineParticipants = participants.filter(p => !p.isOnline);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Participants</h2>
          <p className={styles.subtitle}>
            {participants.length} member{participants.length !== 1 ? 's' : ''} • {onlineParticipants.length} online
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className={styles.addButton}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Add
        </button>
      </div>

      {/* Participants List */}
      <div className={styles.participantsList}>
        {/* Online Participants */}
        {onlineParticipants.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Online ({onlineParticipants.length})</h3>
            </div>
            <div className={styles.participantItems}>
              {onlineParticipants.map(participant => (
                <ParticipantItem
                  key={participant.id}
                  participant={participant}
                  onRemove={handleRemoveParticipant}
                  formatLastSeen={formatLastSeen}
                />
              ))}
            </div>
          </div>
        )}

        {/* Offline Participants */}
        {offlineParticipants.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Offline ({offlineParticipants.length})</h3>
            </div>
            <div className={styles.participantItems}>
              {offlineParticipants.map(participant => (
                <ParticipantItem
                  key={participant.id}
                  participant={participant}
                  onRemove={handleRemoveParticipant}
                  formatLastSeen={formatLastSeen}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {participants.length === 0 && (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <h3>No participants yet</h3>
            <p>Add participants to start collaborating in this room.</p>
          </div>
        )}
      </div>

      {/* Add Participant Modal */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add Participant</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className={styles.closeButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddParticipant} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Name *</label>
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  className={styles.input}
                  placeholder="Enter participant name"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email (optional)</label>
                <input
                  type="email"
                  value={newParticipantEmail}
                  onChange={(e) => setNewParticipantEmail(e.target.value)}
                  className={styles.input}
                  placeholder="Enter email address"
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton}>
                  Add Participant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Participant Item Component
interface ParticipantItemProps {
  participant: Participant;
  onRemove: (participantId: string) => void;
  formatLastSeen: (lastSeen: string) => string;
}

function ParticipantItem({ participant, onRemove, formatLastSeen }: ParticipantItemProps) {
  return (
    <div className={styles.participantItem}>
      <div className={styles.participantInfo}>
        <div className={styles.participantAvatar}>
          <div className={`${styles.avatar} ${participant.isOnline ? styles.avatarOnline : ''}`}>
            {participant.name.charAt(0).toUpperCase()}
          </div>
          {participant.isOnline && <div className={styles.onlineIndicator} />}
        </div>

        <div className={styles.participantDetails}>
          <div className={styles.participantName}>
            {participant.name}
            {participant.role === 'host' && (
              <span className={styles.hostBadge}>Host</span>
            )}
          </div>
          <div className={styles.participantMeta}>
            {participant.email && (
              <span className={styles.participantEmail}>{participant.email}</span>
            )}
            <span className={styles.participantStatus}>
              {participant.isOnline ? (
                'Online'
              ) : participant.lastSeen ? (
                `Last seen ${formatLastSeen(participant.lastSeen)}`
              ) : (
                'Offline'
              )}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.participantActions}>
        <button
          onClick={() => onRemove(participant.id)}
          className={styles.removeButton}
          title="Remove participant"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  );
} 