'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import styles from '@/styles/RoomSettings.module.css';

interface MeetingRoom {
  id: string;
  roomName: string;
  title: string;
  type: string;
  description?: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
  frequency?: string;
  recurringDay?: string;
  recurringTime?: string;
  participants?: Array<{
    _id?: string;
    userId?: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    linkedAt?: string;
  }>;
}

interface RoomSettingsProps {
  room: MeetingRoom;
  roomName: string;
  onRoomUpdated: () => void;
}

interface RoomSettingsForm {
  title: string;
  type: string;
  description: string;
  participants: Array<{
    id?: string;
    name: string;
    email: string;
    role: string;
  }>;
  startDate: string;
  endDate: string;
  frequency: string;
  recurringDay: string;
  recurringTime: string;
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

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' }
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

export function RoomSettings({ room, roomName, onRoomUpdated }: RoomSettingsProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [form, setForm] = useState<RoomSettingsForm>({
    title: '',
    type: '',
    description: '',
    participants: [],
    startDate: '',
    endDate: '',
    frequency: 'daily',
    recurringDay: '',
    recurringTime: ''
  });

  // Initialize form with room data
  useEffect(() => {
    if (room) {
      setForm({
        title: room.title || '',
        type: room.type || '',
        description: room.description || '',
        participants: room.participants?.map(p => ({
          id: p._id,
          name: p.name,
          email: p.email,
          role: p.role
        })) || [],
        startDate: room.startDate || '',
        endDate: room.endDate || '',
        frequency: room.frequency || 'daily',
        recurringDay: room.recurringDay || '',
        recurringTime: room.recurringTime || ''
      });
    }
  }, [room]);

  const handleInputChange = (field: keyof RoomSettingsForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addParticipant = () => {
    setForm(prev => ({
      ...prev,
      participants: [...prev.participants, { name: '', email: '', role: 'participant' }]
    }));
    setHasChanges(true);
  };

  const removeParticipant = (index: number) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.map((p, i) => 
        i === index ? { ...p, [field]: value } : p
      )
    }));
    setHasChanges(true);
  };

  const selectMeetingType = (type: string) => {
    handleInputChange('type', type);
    setShowTypeDropdown(false);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFrequency = e.target.value;
    setForm(prev => ({
      ...prev,
      frequency: newFrequency,
      recurringDay: newFrequency === 'daily' ? '' : prev.recurringDay
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/meetings/${roomName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
          participants: form.participants.filter(p => p.email.trim()),
          startDate: form.startDate,
          endDate: form.endDate,
          frequency: form.frequency,
          recurringDay: form.recurringDay,
          recurringTime: form.recurringTime
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update meeting room');
      }

      const data = await response.json();
      console.log('Meeting room updated:', data);

      setHasChanges(false);
      onRoomUpdated();
      
      // Show success message
      alert('Meeting room updated successfully!');
    } catch (error) {
      console.error('Error updating meeting room:', error);
      alert('Failed to update meeting room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (room) {
      setForm({
        title: room.title || '',
        type: room.type || '',
        description: room.description || '',
        participants: room.participants?.map(p => ({
          id: p._id,
          name: p.name,
          email: p.email,
          role: p.role
        })) || [],
        startDate: room.startDate || '',
        endDate: room.endDate || '',
        frequency: room.frequency || 'daily',
        recurringDay: room.recurringDay || '',
        recurringTime: room.recurringTime || ''
      });
      setHasChanges(false);
    }
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Find current user in participants to show as host
  const currentUserEmail = user?.emailAddresses[0]?.emailAddress;
  const hostParticipant = form.participants.find(p => p.role === 'host');
  const regularParticipants = form.participants.filter(p => p.role !== 'host');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>Room Settings</h2>
            <p className={styles.subtitle}>
              Manage your meeting room details, participants, and schedule
            </p>
          </div>
          {hasChanges && (
            <div className={styles.changeIndicator}>
              <div className={styles.changeDot}></div>
              <span>Unsaved changes</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <form className={styles.settingsForm}>
          {/* Basic Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="title" className={styles.label}>
                Meeting Room Title *
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Weekly Team Standup"
                className={styles.input}
                autoComplete="off"
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
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  placeholder="Enter or select meeting type"
                  className={styles.input}
                  onClick={() => setShowTypeDropdown(true)}
                  autoComplete="off"
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
                Description
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional description for this meeting room"
                className={styles.textarea}
                rows={3}
              />
            </div>
          </div>

          {/* Participants */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Participants</h3>
            
            <div className={styles.participantsList}>
              {/* Host participant */}
              {hostParticipant && (
                <div className={styles.participantRow}>
                  <div className={styles.hostParticipant}>
                    <div className={styles.participantInputs}>
                      <input
                        type="text"
                        value={hostParticipant.name}
                        onChange={(e) => {
                          const hostIndex = form.participants.findIndex(p => p.role === 'host');
                          if (hostIndex !== -1) {
                            updateParticipant(hostIndex, 'name', e.target.value);
                          }
                        }}
                        placeholder="Host name"
                        className={styles.input}
                      />
                      <input
                        type="email"
                        value={hostParticipant.email}
                        onChange={(e) => {
                          const hostIndex = form.participants.findIndex(p => p.role === 'host');
                          if (hostIndex !== -1) {
                            updateParticipant(hostIndex, 'email', e.target.value);
                          }
                        }}
                        placeholder="host@example.com"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.hostBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                      </svg>
                      Host
                    </div>
                  </div>
                </div>
              )}
              
              {/* Regular participants */}
              {regularParticipants.map((participant, index) => {
                const actualIndex = form.participants.findIndex(p => p === participant);
                return (
                  <div key={actualIndex} className={styles.participantRow}>
                    <div className={styles.participantInputs}>
                      <input
                        type="text"
                        value={participant.name}
                        onChange={(e) => updateParticipant(actualIndex, 'name', e.target.value)}
                        placeholder="Participant name"
                        className={styles.input}
                      />
                      <input
                        type="email"
                        value={participant.email}
                        onChange={(e) => updateParticipant(actualIndex, 'email', e.target.value)}
                        placeholder="participant@example.com"
                        className={styles.input}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipant(actualIndex)}
                      className={styles.removeButton}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
              
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

          {/* Schedule */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Schedule</h3>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Meeting Duration
              </label>
              <div className={styles.scheduleContainer}>
                <div className={styles.scheduleRow}>
                  <div className={styles.scheduleField}>
                    <label htmlFor="startDate" className={styles.subLabel}>Start Date</label>
                    <input
                      id="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      min={today}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.scheduleField}>
                    <label htmlFor="endDate" className={styles.subLabel}>End Date</label>
                    <input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      min={form.startDate || today}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Recurring Schedule
              </label>
              <div className={styles.scheduleContainer}>
                <div className={styles.scheduleRow}>
                  <div className={styles.scheduleField}>
                    <label htmlFor="frequency" className={styles.subLabel}>Frequency</label>
                    <select
                      id="frequency"
                      value={form.frequency}
                      onChange={handleFrequencyChange}
                      className={styles.select}
                    >
                      {FREQUENCY_OPTIONS.map((freq) => (
                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                      ))}
                    </select>
                  </div>
                  {form.frequency !== 'daily' && (
                    <div className={styles.scheduleField}>
                      <label htmlFor="day" className={styles.subLabel}>Day</label>
                      <select
                        id="day"
                        value={form.recurringDay}
                        onChange={(e) => handleInputChange('recurringDay', e.target.value)}
                        className={styles.select}
                      >
                        <option value="">Select day</option>
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className={styles.scheduleRow}>
                  <div className={`${styles.scheduleField} ${styles.scheduleFieldFullWidth}`}>
                    <label htmlFor="time" className={styles.subLabel}>Time</label>
                    <select
                      id="time"
                      value={form.recurringTime}
                      onChange={(e) => handleInputChange('recurringTime', e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Select time</option>
                      {TIME_SLOTS.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasChanges}
          className={styles.secondaryButton}
        >
          Reset Changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || !hasChanges || !form.title.trim() || !form.type.trim()}
          className={styles.primaryButton}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
} 