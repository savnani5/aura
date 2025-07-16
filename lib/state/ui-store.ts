import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface Modal {
  id: string
  type: 'create-meeting' | 'meeting-summary' | 'settings' | 'participants' | 'confirm'
  isOpen: boolean
  data?: any
  onClose?: () => void
}

interface UIState {
  // Modal management
  modals: Modal[]
  
  // Meeting Assistant UI
  meetingAssistant: {
    isExpanded: boolean
    activeView: 'public' | 'private'
    publicSubView: 'chat' | 'transcript'
    privateSubView: 'ohm' | 'notes'
    sidebarWidth: number
    isResizing: boolean
  }
  
  // AI Chat UI
  aiChat: {
    isBubbleVisible: boolean
    isExpanded: boolean
    isProcessing: boolean
    expandedSources: Set<string>
  }
  
  // Dashboard UI
  dashboard: {
    sidebarCollapsed: boolean
    viewMode: 'grid' | 'list'
    showQuickActions: boolean
  }
  
  // Toast notifications
  toasts: Toast[]
  
  // Loading states
  globalLoading: boolean
  loadingMessage?: string
  
  // Device detection
  isMobile: boolean

  // User preferences (replaces localStorage)
  userPreferences: {
    cameraMirrored: boolean
    preferredMicId: string
    preferredCameraId: string
    defaultMeetingSettings: any
    referralCode?: string
    [key: string]: any
  }

  // Processing signals (replaces localStorage signals)
  processingSignals: Set<string>
  
  // Actions
  
  // Modal actions
  openModal: (modal: Omit<Modal, 'isOpen'>) => void
  closeModal: (modalId: string) => void
  closeAllModals: () => void
  updateModal: (modalId: string, updates: Partial<Modal>) => void
  
  // Meeting Assistant actions
  setMeetingAssistantExpanded: (expanded: boolean) => void
  setMeetingAssistantView: (view: 'public' | 'private') => void
  setPublicSubView: (subView: 'chat' | 'transcript') => void
  setPrivateSubView: (subView: 'ohm' | 'notes') => void
  setSidebarWidth: (width: number) => void
  setIsResizing: (resizing: boolean) => void
  
  // AI Chat actions
  setAiChatBubbleVisible: (visible: boolean) => void
  setAiChatExpanded: (expanded: boolean) => void
  setAiChatProcessing: (processing: boolean) => void
  toggleExpandedSource: (sourceId: string) => void
  
  // Dashboard actions
  setSidebarCollapsed: (collapsed: boolean) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setShowQuickActions: (show: boolean) => void
  
  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (toastId: string) => void
  clearAllToasts: () => void
  
  // Global loading
  setGlobalLoading: (loading: boolean, message?: string) => void
  
  // Device detection
  setIsMobile: (mobile: boolean) => void
  
  // User preferences
  setUserPreference: (key: string, value: any) => void
  getUserPreference: (key: string) => any
  
  // Processing signals
  addProcessingSignal: (signal: string) => void
  removeProcessingSignal: (signal: string) => void
  hasProcessingSignal: (signal: string) => boolean
  clearProcessingSignals: () => void
  
  // Reset functions
  resetUI: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial state
      modals: [],
      
      meetingAssistant: {
        isExpanded: false,
        activeView: 'public',
        publicSubView: 'chat',
        privateSubView: 'ohm',
        sidebarWidth: 400,
        isResizing: false
      },
      
      aiChat: {
        isBubbleVisible: true,
        isExpanded: false,
        isProcessing: false,
        expandedSources: new Set()
      },
      
      dashboard: {
        sidebarCollapsed: false,
        viewMode: 'grid',
        showQuickActions: true
      },
      
      toasts: [],
      globalLoading: false,
      isMobile: false,

      // User preferences (replaces localStorage)
      userPreferences: {
        cameraMirrored: false,
        preferredMicId: '',
        preferredCameraId: '',
        defaultMeetingSettings: {},
      },

      // Processing signals (replaces localStorage signals)
      processingSignals: new Set(),
      
      // Modal actions
      openModal: (modal) => {
        const modals = get().modals
        const existingIndex = modals.findIndex(m => m.id === modal.id)
        
        if (existingIndex >= 0) {
          // Update existing modal
          const updatedModals = [...modals]
          updatedModals[existingIndex] = { ...updatedModals[existingIndex], ...modal, isOpen: true }
          set({ modals: updatedModals }, false, 'openModal')
        } else {
          // Add new modal
          set({ modals: [...modals, { ...modal, isOpen: true }] }, false, 'openModal')
        }
      },

      closeModal: (modalId) => {
        const modals = get().modals.map(modal =>
          modal.id === modalId ? { ...modal, isOpen: false } : modal
        )
        set({ modals }, false, 'closeModal')
        
        // Remove modal after animation
        setTimeout(() => {
          set({
            modals: get().modals.filter(m => m.id !== modalId)
          }, false, 'removeModal')
        }, 300)
      },

      closeAllModals: () => {
        set({
          modals: get().modals.map(modal => ({ ...modal, isOpen: false }))
        }, false, 'closeAllModals')
        
        setTimeout(() => {
          set({ modals: [] }, false, 'clearModals')
        }, 300)
      },
        
      updateModal: (modalId, updates) =>
        set((state) => ({
          modals: state.modals.map(m =>
            m.id === modalId ? { ...m, ...updates } : m
          )
        }), false, 'updateModal'),
        
      // Meeting Assistant actions
      setMeetingAssistantExpanded: (expanded: boolean) => {
        set({
          meetingAssistant: { ...get().meetingAssistant, isExpanded: expanded }
        }, false, 'setMeetingAssistantExpanded')
      },

      setMeetingAssistantView: (activeView: 'public' | 'private') => {
        set({
          meetingAssistant: { ...get().meetingAssistant, activeView }
        }, false, 'setMeetingAssistantView')
      },

      setMeetingAssistantSubView: (view: 'public' | 'private', subView: string) => {
        const key = view === 'public' ? 'publicSubView' : 'privateSubView'
        set({
          meetingAssistant: { ...get().meetingAssistant, [key]: subView }
        }, false, 'setMeetingAssistantSubView')
      },

      setMeetingAssistantWidth: (sidebarWidth: number) => {
        set({
          meetingAssistant: { ...get().meetingAssistant, sidebarWidth }
        }, false, 'setMeetingAssistantWidth')
      },

      setMeetingAssistantResizing: (isResizing: boolean) => {
        set({
          meetingAssistant: { ...get().meetingAssistant, isResizing }
        }, false, 'setMeetingAssistantResizing')
      },

      // AI Chat actions
      setAIChatBubbleVisible: (isBubbleVisible: boolean) => {
        set({
          aiChat: { ...get().aiChat, isBubbleVisible }
        }, false, 'setAIChatBubbleVisible')
      },

      setAIChatExpanded: (isExpanded: boolean) => {
        set({
          aiChat: { ...get().aiChat, isExpanded }
        }, false, 'setAIChatExpanded')
      },

      setAIChatProcessing: (isProcessing: boolean) => {
        set({
          aiChat: { ...get().aiChat, isProcessing }
        }, false, 'setAIChatProcessing')
      },

      toggleAIChatSource: (sourceId: string) => {
        const expandedSources = new Set(get().aiChat.expandedSources)
        if (expandedSources.has(sourceId)) {
          expandedSources.delete(sourceId)
        } else {
          expandedSources.add(sourceId)
        }
        set({
          aiChat: { ...get().aiChat, expandedSources }
        }, false, 'toggleAIChatSource')
      },

      // Dashboard actions
      setSidebarCollapsed: (collapsed: boolean) => {
        set({
          dashboard: { ...get().dashboard, sidebarCollapsed: collapsed }
        }, false, 'setDashboardSidebarCollapsed')
      },

      setViewMode: (viewMode: 'grid' | 'list') => {
        set({
          dashboard: { ...get().dashboard, viewMode }
        }, false, 'setDashboardViewMode')
      },

      setShowQuickActions: (showQuickActions: boolean) => {
        set({
          dashboard: { ...get().dashboard, showQuickActions }
        }, false, 'setDashboardQuickActions')
      },

      // Toast actions
      addToast: (toast: Omit<Toast, 'id'> & { id?: string }) => {
        const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newToast = { ...toast, id }
        
        set({
          toasts: [...get().toasts, newToast]
        }, false, 'addToast')
        
        // Auto-remove toast after duration
        const duration = toast.duration || 5000
        setTimeout(() => {
          get().removeToast(id)
        }, duration)
        
        return id
      },

      removeToast: (toastId) => {
        set({
          toasts: get().toasts.filter(t => t.id !== toastId)
        }, false, 'removeToast')
      },

      clearToasts: () => {
        set({ toasts: [] }, false, 'clearToasts')
      },

      // Global loading
      setGlobalLoading: (globalLoading, loadingMessage) => {
        set({ globalLoading, loadingMessage }, false, 'setGlobalLoading')
      },

      // Device detection
      setIsMobile: (isMobile: boolean) => {
        set({ isMobile }, false, 'setIsMobile')
      },

        // User preferences
  setUserPreference: (key: string, value: any) => {
    set({
      userPreferences: { ...get().userPreferences, [key]: value }
    }, false, 'setUserPreference')
  },

  getUserPreference: (key: string) => {
    return get().userPreferences[key]
  },

  // Processing signals
  addProcessingSignal: (signal: string) => {
    const signals = new Set(get().processingSignals)
    signals.add(signal)
    set({ processingSignals: signals }, false, 'addProcessingSignal')
  },

  removeProcessingSignal: (signal: string) => {
    const signals = new Set(get().processingSignals)
    signals.delete(signal)
    set({ processingSignals: signals }, false, 'removeProcessingSignal')
  },

  hasProcessingSignal: (signal: string) => {
    return get().processingSignals.has(signal)
  },

      clearProcessingSignals: () => {
        set({ processingSignals: new Set() }, false, 'clearProcessingSignals')
      }
    }),
    { name: 'ui-store' }
  )
)

// localStorage compatibility utilities for UI preferences
export const UIStorageUtils = {
  // Camera mirroring (replaces localStorage.getItem('camera-mirrored'))
  setCameraMirrored: (isMirrored: boolean) => {
    useUIStore.getState().setUserPreference('cameraMirrored', isMirrored)
  },

  getCameraMirrored: (): boolean => {
    return useUIStore.getState().getUserPreference('cameraMirrored') || false
  },

  // Meeting settings (replaces localStorage.getItem('meetingSettings'))
  setMeetingSettings: (settings: any) => {
    useUIStore.getState().setUserPreference('defaultMeetingSettings', settings)
  },

  getMeetingSettings: () => {
    return useUIStore.getState().getUserPreference('defaultMeetingSettings') || {}
  },

  // Processing signals (replaces localStorage signals)
  setProcessingComplete: (type: 'transcript' | 'summary' | 'analysis') => {
    useUIStore.getState().addProcessingSignal(`${type}-processing-complete`)
  },

  setProcessingFailed: (type: 'transcript' | 'summary' | 'analysis') => {
    useUIStore.getState().addProcessingSignal(`${type}-processing-failed`)
  },

  getProcessingComplete: (type: 'transcript' | 'summary' | 'analysis'): boolean => {
    return useUIStore.getState().hasProcessingSignal(`${type}-processing-complete`)
  },

  getProcessingFailed: (type: 'transcript' | 'summary' | 'analysis'): boolean => {
    return useUIStore.getState().hasProcessingSignal(`${type}-processing-failed`)
  },

  clearProcessingSignal: (type: 'transcript' | 'summary' | 'analysis', status: 'complete' | 'failed') => {
    useUIStore.getState().removeProcessingSignal(`${type}-processing-${status}`)
  },

  // Referral code (replaces localStorage.getItem('ohm_referral'))
  setReferralCode: (code: string) => {
    useUIStore.getState().setUserPreference('referralCode', code)
  },

  getReferralCode: (): string | null => {
    return useUIStore.getState().getUserPreference('referralCode') || null
  },

  clearReferralCode: () => {
    useUIStore.getState().setUserPreference('referralCode', null)
  }
}

// Selectors for easier component usage
export const useUISelectors = () => {
  const store = useUIStore()
  
  return {
    // Modal state
    modals: store.modals,
    openModals: store.modals.filter(m => m.isOpen),
    hasOpenModal: store.modals.some(m => m.isOpen),
    
    // Meeting Assistant state
    meetingAssistant: store.meetingAssistant,
    isMeetingAssistantExpanded: store.meetingAssistant.isExpanded,
    
    // AI Chat state
    aiChat: store.aiChat,
    isAiChatVisible: store.aiChat.isBubbleVisible,
    isAiChatExpanded: store.aiChat.isExpanded,
    isAiProcessing: store.aiChat.isProcessing,
    
    // Dashboard state
    dashboard: store.dashboard,
    isDashboardSidebarCollapsed: store.dashboard.sidebarCollapsed,
    
    // Toast state
    toasts: store.toasts,
    hasToasts: store.toasts.length > 0,
    
    // Global state
    isGlobalLoading: store.globalLoading,
    loadingMessage: store.loadingMessage,
    isMobile: store.isMobile,
  }
}

// Hook for UI actions
export const useUIActions = () => {
  const {
    openModal,
    closeModal,
    closeAllModals,
    updateModal,
    setMeetingAssistantExpanded,
    setMeetingAssistantView,
    setPublicSubView,
    setPrivateSubView,
    setSidebarWidth,
    setIsResizing,
    setAiChatBubbleVisible,
    setAiChatExpanded,
    setAiChatProcessing,
    toggleExpandedSource,
    setSidebarCollapsed,
    setViewMode,
    setShowQuickActions,
    addToast,
    removeToast,
    clearAllToasts,
    setGlobalLoading,
    setIsMobile,
    resetUI,
  } = useUIStore()
  
  return {
    // Modal actions
    openModal,
    closeModal,
    closeAllModals,
    updateModal,
    
    // Meeting Assistant actions
    setMeetingAssistantExpanded,
    setMeetingAssistantView,
    setPublicSubView,
    setPrivateSubView,
    setSidebarWidth,
    setIsResizing,
    
    // AI Chat actions
    setAiChatBubbleVisible,
    setAiChatExpanded,
    setAiChatProcessing,
    toggleExpandedSource,
    
    // Dashboard actions
    setSidebarCollapsed,
    setViewMode,
    setShowQuickActions,
    
    // Toast actions
    addToast,
    removeToast,
    clearAllToasts,
    
    // Global actions
    setGlobalLoading,
    setIsMobile,
    resetUI,
    
    // Convenience methods
    showSuccess: (message: string) => addToast({ message, type: 'success' }),
    showError: (message: string) => addToast({ message, type: 'error' }),
    showWarning: (message: string) => addToast({ message, type: 'warning' }),
    showInfo: (message: string) => addToast({ message, type: 'info' }),
  }
} 