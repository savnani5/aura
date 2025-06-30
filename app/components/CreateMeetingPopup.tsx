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
  participants: { name: string; email: string }[];
  startDate: string;
  endDate: string;
  frequency: string;
  recurringDay: string;
  recurringTime: string;
  recurringDuration: number;
  recurringTimezone: string;
}

interface QuickRoomForm {
  title: string;
}

type CreateMode = 'selection' | 'quick' | 'full';

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

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' }
];

export function CreateMeetingPopup({ isOpen, onClose, onMeetingCreated }: CreateMeetingPopupProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('selection');
  
  // Detect user's timezone
  const getUserTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('Unable to detect timezone, falling back to UTC:', error);
      return 'UTC';
    }
  };

  const defaultTimezone = getUserTimezone();
  
  // Form state for full setup
  const [form, setForm] = useState<MeetingRoomForm>({
    title: '',
    type: '',
    participants: [{ name: '', email: '' }],
    startDate: '',
    endDate: '',
    frequency: 'weekly',
    recurringDay: '',
    recurringTime: '',
    recurringDuration: 60,
    recurringTimezone: defaultTimezone
  });

  // Form state for quick room
  const [quickForm, setQuickForm] = useState<QuickRoomForm>({
    title: '',
  });

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Reset state when popup opens - MUST be before early return
  React.useEffect(() => {
    if (isOpen) {
      setCreateMode('selection');
      setForm({
        title: '',
        type: '',
        participants: [{ name: '', email: '' }],
        startDate: '',
        endDate: '',
        frequency: 'weekly',
        recurringDay: '',
        recurringTime: '',
        recurringDuration: 60,
        recurringTimezone: defaultTimezone
      });
      setQuickForm({
        title: '',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const handleCreateQuickRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.title.trim()) return;

    setIsLoading(true);
    
    try {
      // Only add current user as host for quick rooms
      const allParticipants = [
        {
          email: user?.emailAddresses[0]?.emailAddress || '',
          name: user?.fullName || user?.firstName || 'Host',
          role: 'host'
        }
      ];
      
      // Generate room ID from title
      const roomId = quickForm.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30) + '-' + Date.now().toString(36);

      const requestData = {
        roomName: roomId,
        title: quickForm.title.trim(),
        type: 'Meeting', // Default type for quick rooms
        isRecurring: false, // Quick rooms are not recurring by default
        participants: allParticipants
      };

      console.log('Creating quick meeting room with data:', requestData);

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
      console.log('Quick meeting room created:', data);

      // Show success message
      toast.success(`Workspace "${quickForm.title}" created successfully! You can configure more settings in the room dashboard.`);

      // Notify parent component that a meeting room was created (this will refresh the data and close popup)
      onMeetingCreated?.();

    } catch (error) {
      console.error('Error creating quick meeting room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create meeting room. Please try again.';
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.type.trim()) return;

    setIsLoading(true);
    
    try {
      // Filter out empty participants and add current user as host
      const validParticipants = form.participants.filter(p => p.name.trim() && p.email.trim());
      
      // Add current user as the host/creator
      const allParticipants = [
        {
          email: user?.emailAddresses[0]?.emailAddress || '',
          name: user?.fullName || user?.firstName || 'Host',
          role: 'host'
        },
        // Add other participants as regular participants
        ...validParticipants.map(participant => ({
          email: participant.email.trim(),
          name: participant.name.trim(),
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
        recurringTime: form.recurringTime,
        recurringDuration: form.recurringDuration,
        recurringTimezone: form.recurringTimezone
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
      toast.success(`Workspace "${form.title}" created successfully! You can now see it in your workspaces.`);

      // Reset form for next use
      setForm({
        title: '',
        type: '',
        participants: [{ name: '', email: '' }],
        startDate: '',
        endDate: '',
        frequency: 'daily',
        recurringDay: '',
        recurringTime: '',
        recurringDuration: 0,
        recurringTimezone: defaultTimezone
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
    // Only for scheduled room (full form)
    setForm(prev => ({
      ...prev,
      participants: [...prev.participants, { name: '', email: '' }]
    }));
  };

  const removeParticipant = (index: number) => {
    // Only for scheduled room (full form)
    setForm(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }));
  };

  const updateParticipantName = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.map((p, i) => i === index ? { ...p, name: value } : p)
    }));
  };

  const updateParticipantEmail = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.map((p, i) => i === index ? { ...p, email: value } : p)
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

  const renderSelectionScreen = () => (
    <div className={styles.content}>
      <div className={styles.selectionContainer}>
        <div className={styles.simpleOptions}>
          <button 
            className={styles.optionButton}
            onClick={() => setCreateMode('quick')}
          >
            <div className={styles.optionButtonIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            Quick Workspace
          </button>
          
          <button 
            className={styles.optionButton}
            onClick={() => setCreateMode('full')}
          >
            <div className={styles.optionButtonIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            Scheduled Workspace
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuickForm = () => (
    <div className={styles.content}>
      <form onSubmit={handleCreateQuickRoom} className={styles.createForm}>
        <div className={styles.formGroup}>
          <label htmlFor="quickTitle" className={styles.label}>
            Workspace Title *
          </label>
          <input
            id="quickTitle"
            type="text"
            value={quickForm.title}
            onChange={(e) => setQuickForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Team Brainstorming Session"
            className={styles.input}
            autoComplete="off"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Host
          </label>
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

        <div className={styles.formActions}>
          <button
            type="button"
            onClick={() => setCreateMode('selection')}
            className={styles.secondaryButton}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading || !quickForm.title.trim()}
            className={styles.primaryButton}
          >
            {isLoading ? 'Creating...' : 'Create Quick Workspace'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderFullForm = () => (
    <div className={styles.content}>
      <form onSubmit={handleCreateRoom} className={styles.createForm}>
        <div className={styles.formGroup}>
          <label htmlFor="title" className={styles.label}>
            Workspace Title *
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
            Duration
          </label>
          <select
            value={form.recurringDuration}
            onChange={(e) => setForm(prev => ({ ...prev, recurringDuration: Number(e.target.value) }))}
            className={styles.select}
            required
          >
            {DURATION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Timezone
          </label>
          <div className={styles.timezoneContainer}>
            <select
              id="timezone"
              value={form.recurringTimezone}
              onChange={(e) => setForm(prev => ({ ...prev, recurringTimezone: e.target.value }))}
              className={styles.select}
              required
            >
              {COMMON_TIMEZONES.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>{timezone.label}</option>
              ))}
            </select>
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
                  type="text"
                  value={participant.name}
                  onChange={(e) => updateParticipantName(index, e.target.value)}
                  placeholder="Name"
                  className={styles.input}
                  autoComplete="off"
                />
                <input
                  type="email"
                  value={participant.email}
                  onChange={(e) => updateParticipantEmail(index, e.target.value)}
                  placeholder="Email"
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
            onClick={() => setCreateMode('selection')}
            className={styles.secondaryButton}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading || !form.title.trim() || !form.type.trim() || !form.startDate || !form.endDate || (form.frequency !== 'daily' && !form.recurringDay) || !form.recurringTime || !form.recurringTimezone}
            className={styles.primaryButton}
          >
            {isLoading ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Workspace</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {createMode === 'selection' && renderSelectionScreen()}
        {createMode === 'quick' && renderQuickForm()}
        {createMode === 'full' && renderFullForm()}
      </div>
    </div>
  );
} 