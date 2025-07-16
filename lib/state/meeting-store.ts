import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface Transcript {
  id: string
  speaker: string
  text: string
  timestamp: number
  participantId?: string
  isLocal?: boolean
  speakerConfidence?: number
}

export interface Participant {
  id: string
  name: string
  email?: string
  avatar?: string
  isOnline: boolean
  isHost?: boolean
  joinedAt?: Date
  leftAt?: Date
}

export interface Meeting {
  id: string
  roomName: string
  title: string
  type: string
  startedAt?: Date
  endedAt?: Date
  duration?: number
  isActive: boolean
  participants: Participant[]
  transcripts: Transcript[]
}

interface MeetingState {
  // Current meeting data
  currentMeeting: Meeting | null
  isRecording: boolean
  
  // Meeting notes (replaces localStorage)
  meetingNotes: Record<string, string> // roomName -> notes
  
  // Actions
  setCurrentMeeting: (meeting: Meeting | null) => void
  updateMeeting: (updates: Partial<Meeting>) => void
  addTranscript: (transcript: Transcript) => void
  addParticipant: (participant: Participant) => void
  removeParticipant: (participantId: string) => void
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void
  setRecording: (isRecording: boolean) => void
  
  // Notes management
  setMeetingNotes: (roomName: string, notes: string) => void
  getMeetingNotes: (roomName: string) => string
  clearMeetingNotes: (roomName: string) => void
  
  // Reset functions
  resetMeeting: () => void
  clearAllData: () => void
}

export const useMeetingStore = create<MeetingState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentMeeting: null,
        isRecording: false,
        meetingNotes: {},

        // Meeting management
        setCurrentMeeting: (meeting) => {
          set({ currentMeeting: meeting }, false, 'setCurrentMeeting')
        },

        updateMeeting: (updates) => {
          const currentMeeting = get().currentMeeting
          if (!currentMeeting) return
          
          set({
            currentMeeting: { ...currentMeeting, ...updates }
          }, false, 'updateMeeting')
        },

        addTranscript: (transcript) => {
          const currentMeeting = get().currentMeeting
          if (!currentMeeting) return

          const updatedTranscripts = [...currentMeeting.transcripts, transcript]
          set({
            currentMeeting: {
              ...currentMeeting,
              transcripts: updatedTranscripts
            }
          }, false, 'addTranscript')
        },

        addParticipant: (participant) => {
          const currentMeeting = get().currentMeeting
          if (!currentMeeting) return

          const existingIndex = currentMeeting.participants.findIndex(p => p.id === participant.id)
          let updatedParticipants

          if (existingIndex >= 0) {
            // Update existing participant
            updatedParticipants = [...currentMeeting.participants]
            updatedParticipants[existingIndex] = { ...updatedParticipants[existingIndex], ...participant }
          } else {
            // Add new participant
            updatedParticipants = [...currentMeeting.participants, participant]
          }

          set({
            currentMeeting: {
              ...currentMeeting,
              participants: updatedParticipants
            }
          }, false, 'addParticipant')
        },

        removeParticipant: (participantId) => {
          const currentMeeting = get().currentMeeting
          if (!currentMeeting) return

          const updatedParticipants = currentMeeting.participants.filter(p => p.id !== participantId)
          set({
            currentMeeting: {
              ...currentMeeting,
              participants: updatedParticipants
            }
          }, false, 'removeParticipant')
        },

        updateParticipant: (participantId, updates) => {
          const currentMeeting = get().currentMeeting
          if (!currentMeeting) return

          const updatedParticipants = currentMeeting.participants.map(p => 
            p.id === participantId ? { ...p, ...updates } : p
          )

          set({
            currentMeeting: {
              ...currentMeeting,
              participants: updatedParticipants
            }
          }, false, 'updateParticipant')
        },

        setRecording: (isRecording) => {
          set({ isRecording }, false, 'setRecording')
        },

        // Notes management
        setMeetingNotes: (roomName, notes) => {
          const meetingNotes = get().meetingNotes
          set({
            meetingNotes: { ...meetingNotes, [roomName]: notes }
          }, false, 'setMeetingNotes')
        },

        getMeetingNotes: (roomName) => {
          return get().meetingNotes[roomName] || ''
        },

        clearMeetingNotes: (roomName) => {
          const meetingNotes = get().meetingNotes
          const updated = { ...meetingNotes }
          delete updated[roomName]
          set({ meetingNotes: updated }, false, 'clearMeetingNotes')
        },

        // Reset functions
        resetMeeting: () => {
          set({
            currentMeeting: null,
            isRecording: false
          }, false, 'resetMeeting')
        },

        clearAllData: () => {
          set({
            currentMeeting: null,
            isRecording: false,
            meetingNotes: {}
          }, false, 'clearAllData')
        }
      }),
      {
        name: 'ohm-meeting-store',
        // Only persist meeting notes and some metadata
        partialize: (state) => ({
          meetingNotes: state.meetingNotes,
          // Don't persist currentMeeting as it should be session-specific
        }),
      }
    ),
    { name: 'meeting-store' }
  )
)

// localStorage compatibility utilities for smooth migration
export const MeetingStorageUtils = {
  // Meeting ID storage (replaces localStorage.setItem(`meeting-id-${roomName}`, meetingId))
  setMeetingId: (roomName: string, meetingId: string) => {
    // Check for existing active meeting (overlap prevention)
    const currentMeeting = useMeetingStore.getState().currentMeeting
    if (currentMeeting && currentMeeting.isActive && currentMeeting.roomName !== roomName) {
      console.warn(`⚠️ Overlap detected: Ending previous meeting "${currentMeeting.roomName}" to start "${roomName}"`)
      // Mark previous meeting as ended
      useMeetingStore.getState().updateMeeting({
        isActive: false,
        endedAt: new Date()
      })
    }

    const store = useMeetingStore.getState()
    if (store.currentMeeting && store.currentMeeting.roomName === roomName) {
      store.updateMeeting({ id: meetingId })
    } else {
      // Create new meeting if none exists
      store.setCurrentMeeting({
        id: meetingId,
        roomName,
        title: roomName,
        type: 'meeting',
        isActive: true,
        participants: [],
        transcripts: [],
        startedAt: new Date()
      })
    }
  },

  // Meeting ID retrieval (replaces localStorage.getItem(`meeting-id-${roomName}`))
  getMeetingId: (roomName: string): string | null => {
    const meeting = useMeetingStore.getState().currentMeeting
    if (meeting && meeting.roomName === roomName) {
      return meeting.id
    }
    return null
  },

  // Remove meeting ID (replaces localStorage.removeItem(`meeting-id-${roomName}`))
  removeMeetingId: (roomName: string) => {
    const meeting = useMeetingStore.getState().currentMeeting
    if (meeting && meeting.roomName === roomName) {
      // Mark meeting as ended instead of clearing completely
      useMeetingStore.getState().updateMeeting({
        isActive: false,
        endedAt: new Date()
      })
    }
  },

  // Meeting notes with user-specific storage (replaces complex localStorage notes logic)
  setUserMeetingNotes: (roomName: string, userId: string, notes: string) => {
    const storageKey = `${roomName}-${userId}`
    useMeetingStore.getState().setMeetingNotes(storageKey, notes)
  },

  getUserMeetingNotes: (roomName: string, userId: string): string => {
    const storageKey = `${roomName}-${userId}`
    return useMeetingStore.getState().getMeetingNotes(storageKey)
  },

  clearUserMeetingNotes: (roomName: string, userId: string) => {
    const storageKey = `${roomName}-${userId}`
    useMeetingStore.getState().clearMeetingNotes(storageKey)
  },

  // Meeting overlap prevention utilities
  checkForActiveMeeting: (): Meeting | null => {
    const meeting = useMeetingStore.getState().currentMeeting
    return meeting && meeting.isActive ? meeting : null
  },

  endCurrentMeeting: (reason?: string) => {
    const currentMeeting = useMeetingStore.getState().currentMeeting
    if (currentMeeting && currentMeeting.isActive) {
      console.log(`🛑 Ending current meeting "${currentMeeting.roomName}"${reason ? ` - ${reason}` : ''}`)
      useMeetingStore.getState().updateMeeting({
        isActive: false,
        endedAt: new Date()
      })
    }
  },

  canStartNewMeeting: (roomName: string): { canStart: boolean; reason?: string; conflictingMeeting?: Meeting } => {
    const currentMeeting = useMeetingStore.getState().currentMeeting
    
    // No current meeting - safe to start
    if (!currentMeeting || !currentMeeting.isActive) {
      return { canStart: true }
    }

    // Same room - already in this meeting
    if (currentMeeting.roomName === roomName) {
      return { canStart: true }
    }

    // Different room - potential conflict
    return {
      canStart: false,
      reason: `Active meeting in "${currentMeeting.roomName}" must be ended first`,
      conflictingMeeting: currentMeeting
    }
  }
}

// Selectors for easier component usage
export const useMeetingSelectors = () => {
  const store = useMeetingStore()
  
  return {
    // Current meeting data
    currentMeeting: store.currentMeeting,
    isInMeeting: !!store.currentMeeting,
    isRecording: store.isRecording,
    
    // Participants
    participants: store.currentMeeting?.participants || [],
    onlineParticipants: store.currentMeeting?.participants.filter(p => p.isOnline) || [],
    hostParticipants: store.currentMeeting?.participants.filter(p => p.isHost) || [],
    
    // Transcripts
    transcripts: store.currentMeeting?.transcripts || [],
    transcriptCount: store.currentMeeting?.transcripts.length || 0,
    
    // Latest activity
    latestTranscript: store.currentMeeting?.transcripts.slice(-1)[0] || null,
    
    // Meeting duration
    meetingDuration: store.currentMeeting?.startedAt 
      ? Math.floor((Date.now() - store.currentMeeting.startedAt.getTime()) / (1000 * 60))
      : 0,
  }
} 