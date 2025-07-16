import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface Workspace {
  id: string
  roomName: string
  title: string
  type: string
  description?: string
  isRecurring: boolean
  participants: Array<{
    _id?: string
    userId?: string
    name: string
    email: string
    role: string
    avatar?: string
    linkedAt?: string
  }>
  createdAt: string
  updatedAt: string
  meetingCount?: number
  lastActivity?: Date
}

export interface RecentMeeting {
  id: string
  roomName: string
  title: string
  type: string
  startedAt: Date
  endedAt?: Date
  duration?: number
  participantCount: number
  hasTranscripts: boolean
  hasSummary: boolean
}

interface WorkspaceState {
  // Current workspace/navigation
  currentWorkspace: Workspace | null
  workspaces: Workspace[]
  recentMeetings: RecentMeeting[]
  
  // Loading states
  isLoadingWorkspaces: boolean
  isLoadingMeetings: boolean
  
  // Navigation state
  activePanel: 'prep' | 'history' | 'tasks' | 'settings'
  
  // Search and filters
  searchQuery: string
  workspaceFilter: 'all' | 'recent' | 'favorites'
  
  // Actions
  setCurrentWorkspace: (workspace: Workspace | null) => void
  setWorkspaces: (workspaces: Workspace[]) => void
  addWorkspace: (workspace: Workspace) => void
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void
  removeWorkspace: (workspaceId: string) => void
  
  // Recent meetings
  setRecentMeetings: (meetings: RecentMeeting[]) => void
  addRecentMeeting: (meeting: RecentMeeting) => void
  
  // Navigation
  setActivePanel: (panel: 'prep' | 'history' | 'tasks' | 'settings') => void
  
  // Search and filters
  setSearchQuery: (query: string) => void
  setWorkspaceFilter: (filter: 'all' | 'recent' | 'favorites') => void
  
  // Loading states
  setLoadingWorkspaces: (loading: boolean) => void
  setLoadingMeetings: (loading: boolean) => void
  
  // Computed getters
  getFilteredWorkspaces: () => Workspace[]
  getWorkspaceById: (id: string) => Workspace | undefined
  
  // Reset functions
  resetWorkspace: () => void
  clearAllData: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentWorkspace: null,
        workspaces: [],
        recentMeetings: [],
        isLoadingWorkspaces: false,
        isLoadingMeetings: false,
        activePanel: 'prep',
        searchQuery: '',
        workspaceFilter: 'all',
        
        // Actions
        setCurrentWorkspace: (workspace) =>
          set({ currentWorkspace: workspace }, false, 'setCurrentWorkspace'),
          
        setWorkspaces: (workspaces) =>
          set({ workspaces }, false, 'setWorkspaces'),
          
        addWorkspace: (workspace) =>
          set((state) => ({
            workspaces: [...state.workspaces, workspace]
          }), false, 'addWorkspace'),
          
        updateWorkspace: (workspaceId, updates) =>
          set((state) => ({
            workspaces: state.workspaces.map(w =>
              w.id === workspaceId ? { ...w, ...updates } : w
            ),
            currentWorkspace: state.currentWorkspace?.id === workspaceId
              ? { ...state.currentWorkspace, ...updates }
              : state.currentWorkspace
          }), false, 'updateWorkspace'),
          
        removeWorkspace: (workspaceId) =>
          set((state) => ({
            workspaces: state.workspaces.filter(w => w.id !== workspaceId),
            currentWorkspace: state.currentWorkspace?.id === workspaceId
              ? null
              : state.currentWorkspace
          }), false, 'removeWorkspace'),
          
        // Recent meetings
        setRecentMeetings: (meetings) =>
          set({ recentMeetings: meetings }, false, 'setRecentMeetings'),
          
        addRecentMeeting: (meeting) =>
          set((state) => ({
            recentMeetings: [meeting, ...state.recentMeetings].slice(0, 20) // Keep last 20
          }), false, 'addRecentMeeting'),
          
        // Navigation
        setActivePanel: (panel) =>
          set({ activePanel: panel }, false, 'setActivePanel'),
          
        // Search and filters
        setSearchQuery: (query) =>
          set({ searchQuery: query }, false, 'setSearchQuery'),
          
        setWorkspaceFilter: (filter) =>
          set({ workspaceFilter: filter }, false, 'setWorkspaceFilter'),
          
        // Loading states
        setLoadingWorkspaces: (loading) =>
          set({ isLoadingWorkspaces: loading }, false, 'setLoadingWorkspaces'),
          
        setLoadingMeetings: (loading) =>
          set({ isLoadingMeetings: loading }, false, 'setLoadingMeetings'),
          
        // Computed getters
        getFilteredWorkspaces: () => {
          const state = get()
          let filtered = state.workspaces
          
          // Apply search filter
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase()
            filtered = filtered.filter(w =>
              w.title.toLowerCase().includes(query) ||
              w.type.toLowerCase().includes(query) ||
              w.roomName.toLowerCase().includes(query)
            )
          }
          
          // Apply type filter
          switch (state.workspaceFilter) {
            case 'recent':
              filtered = filtered.filter(w => w.lastActivity)
                .sort((a, b) => 
                  (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0)
                )
              break
            case 'favorites':
              // Add favorites logic when implemented
              break
            default:
              // All workspaces
              break
          }
          
          return filtered
        },
        
        getWorkspaceById: (id) => {
          const state = get()
          return state.workspaces.find(w => w.id === id)
        },
        
        // Reset functions
        resetWorkspace: () =>
          set({
            currentWorkspace: null,
            activePanel: 'prep'
          }, false, 'resetWorkspace'),
          
        clearAllData: () =>
          set({
            currentWorkspace: null,
            workspaces: [],
            recentMeetings: [],
            isLoadingWorkspaces: false,
            isLoadingMeetings: false,
            activePanel: 'prep',
            searchQuery: '',
            workspaceFilter: 'all'
          }, false, 'clearAllData'),
      }),
      {
        name: 'ohm-workspace-store',
        partialize: (state) => ({
          activePanel: state.activePanel, // Persist last active panel
          workspaceFilter: state.workspaceFilter, // Persist filter preference
        })
      }
    ),
    {
      name: 'WorkspaceStore'
    }
  )
)

// Selectors for easier component usage
export const useWorkspaceSelectors = () => {
  const store = useWorkspaceStore()
  
  return {
    // Current workspace
    currentWorkspace: store.currentWorkspace,
    isInWorkspace: !!store.currentWorkspace,
    
    // Workspaces
    allWorkspaces: store.workspaces,
    filteredWorkspaces: store.getFilteredWorkspaces(),
    workspaceCount: store.workspaces.length,
    
    // Recent meetings
    recentMeetings: store.recentMeetings,
    recentMeetingCount: store.recentMeetings.length,
    
    // Current workspace meetings
    currentWorkspaceMeetings: store.recentMeetings.filter(
      m => m.roomName === store.currentWorkspace?.roomName
    ),
    
    // Loading states
    isLoading: store.isLoadingWorkspaces || store.isLoadingMeetings,
    
    // Navigation
    activePanel: store.activePanel,
    
    // Search state
    searchQuery: store.searchQuery,
    hasActiveSearch: store.searchQuery.length > 0,
    
    // Filter state
    workspaceFilter: store.workspaceFilter,
  }
}

// Hook for workspace actions
export const useWorkspaceActions = () => {
  const {
    setCurrentWorkspace,
    setWorkspaces,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setRecentMeetings,
    addRecentMeeting,
    setActivePanel,
    setSearchQuery,
    setWorkspaceFilter,
    setLoadingWorkspaces,
    setLoadingMeetings,
    resetWorkspace,
    clearAllData,
  } = useWorkspaceStore()
  
  return {
    setCurrentWorkspace,
    setWorkspaces,
    addWorkspace,
    updateWorkspace,
    removeWorkspace,
    setRecentMeetings,
    addRecentMeeting,
    setActivePanel,
    setSearchQuery,
    setWorkspaceFilter,
    setLoadingWorkspaces,
    setLoadingMeetings,
    resetWorkspace,
    clearAllData,
  }
} 