'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import toast from 'react-hot-toast';
import styles from '@/styles/CreateMeetingPopup.module.css';

interface CreateMeetingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated?: () => void;
}

interface MeetingRoomForm {
  title: string;
  type: string;
  participants: string[];
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

export function CreateMeetingPopup({ isOpen, onClose, onMeetingCreated }: CreateMeetingPopupProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state for creating meeting room
  const [form, setForm] = useState<MeetingRoomForm>({
    title: '',
    type: '',
    participants: [''],
    startDate: '',
    endDate: '',
    frequency: 'daily',
    recurringDay: '',
    recurringTime: ''
  });

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  if (!isOpen) return null;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.type.trim()) return;

    setIsLoading(true);
    
    try {
      // Filter out empty participants and add current user as host
      const validParticipants = form.participants.filter(p => p.trim());
      
      // Add current user as the host/creator
      const allParticipants = [
        {
          email: user?.emailAddresses[0]?.emailAddress || '',
          name: user?.fullName || user?.firstName || 'Host',
          role: 'host'
        },
        // Add other participants as regular participants
        ...validParticipants.map(email => ({
          email: email.trim(),
          name: '', // Will be filled when they join
          role: 'participant'
        }))
      ];
      
      // Generate room ID from title
      const roomId = form.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30) + '-' + Date.now().toString(36);

      const requestData = {
        roomName: roomId,
        title: form.title.trim(),
        type: form.type.trim(),
        isRecurring: true, // Meeting rooms are persistent/recurring
        participants: allParticipants,
        startDate: form.startDate,
        endDate: form.endDate,
        frequency: form.frequency,
        recurringDay: form.recurringDay,
        recurringTime: form.recurringTime
      };

      console.log('Creating meeting room with data:', requestData);

      // Create meeting room via API
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create meeting room`);
      }

      const data = await response.json();
      console.log('Meeting room created:', data);

      // Show success message
      toast.success(`Meeting room "${form.title}" created successfully! You can now see it in your meeting rooms.`);

      // Reset form for next use
      setForm({
        title: '',
        type: '',
        participants: [''],
        startDate: '',
        endDate: '',
        frequency: 'daily',
        recurringDay: '',
        recurringTime: ''
      });

      // Notify parent component that a meeting room was created (this will refresh the data and close popup)
      onMeetingCreated?.();

    } catch (error) {
      console.error('Error creating meeting room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create meeting room. Please try again.';
      toast.error(errorMessage);
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

  // Close dropdown when clicking outside
  const handleTypeInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTypeDropdown(true);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFrequency = e.target.value;
    setForm(prev => ({
      ...prev,
      frequency: newFrequency,
      // Clear recurringDay when switching to daily
      recurringDay: newFrequency === 'daily' ? '' : prev.recurringDay
    }));
  };

  // Get user display name for host
  const userDisplayName = user?.fullName || user?.firstName || 'You';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Meeting Room</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
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
                    onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="Enter or select meeting type"
                    className={styles.input}
                    onClick={handleTypeInputClick}
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
                <label className={styles.label}>
                  Meeting Duration *
                </label>
                <div className={styles.scheduleContainer}>
                  <div className={styles.scheduleRow}>
                    <div className={styles.scheduleField}>
                      <label htmlFor="startDate" className={styles.subLabel}>Start Date</label>
                      <input
                        id="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                        min={today}
                        className={styles.input}
                        required
                      />
                    </div>
                    <div className={styles.scheduleField}>
                      <label htmlFor="endDate" className={styles.subLabel}>End Date</label>
                      <input
                        id="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                        min={form.startDate || today}
                        className={styles.input}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Recurring Schedule *
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
                        required
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
                          onChange={(e) => setForm(prev => ({ ...prev, recurringDay: e.target.value }))}
                          className={styles.select}
                          required
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
                        onChange={(e) => setForm(prev => ({ ...prev, recurringTime: e.target.value }))}
                        className={styles.select}
                        required
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

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Participants
                </label>
                <div className={styles.participantsList}>
                {/* Current user as host/creator - always first */}
                <div className={styles.participantRow}>
                  <div className={styles.hostParticipant}>
                    <input
                      type="text"
                      value={`${userDisplayName} (Host)`}
                      className={`${styles.input} ${styles.hostInput}`}
                      disabled
                      readOnly
                    />
                    <div className={styles.hostBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                      </svg>
                      Host
                    </div>
                  </div>
                </div>
                
                {/* Additional participants */}
                  {form.participants.map((participant, index) => (
                    <div key={index} className={styles.participantRow}>
                      <input
                        type="email"
                        value={participant}
                        onChange={(e) => updateParticipant(index, e.target.value)}
                        placeholder="participant@example.com"
                        className={styles.input}
                        autoComplete="off"
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
                  disabled={isLoading || !form.title.trim() || !form.type.trim() || !form.startDate || !form.endDate || (form.frequency !== 'daily' && !form.recurringDay) || !form.recurringTime}
                  className={styles.primaryButton}
                >
                  {isLoading ? 'Creating...' : 'Create Meeting Room'}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
} 