'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { WorkspaceSidebar } from './workspace-sidebar';
import { MeetingDatabase } from './meeting-database';
import { AiChatPanel } from './ai-chat-panel';
import { UserSettingsBubble } from './user-settings-bubble';
import { WorkspaceSettings } from './workspace-settings';
import { BillingModal } from './billing-modal';
import { IntegrationsModal } from './integrations-modal';
import { HelpSupportModal } from './help-support-modal';
import { PaywallModal } from './paywall-modal';
import { TaskManagementPanel } from './task-management-panel';
import { useUsageTracking } from '@/app/subscription/hooks/useUsageTracking';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Settings, User, Users, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  objectId: string; // MongoDB ObjectId for database queries
  name: string;
  type: string;
  description?: string;
  participantCount: number;
  lastActivity: string;
  recentMeetings: number;
  isActive: boolean;
}

interface Meeting {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime?: string;
  duration?: string;
  participants: Array<{ name: string; avatar?: string }>;
  summary?: {
    title?: string;
    content?: string;
    sections?: Array<{
      title: string;
      points: Array<{
        text: string;
        speaker?: string;
        context?: {
          speaker: string;
          reasoning: string;
          transcriptExcerpt: string;
          relatedDiscussion: string;
        };
      }>;
    }>;
    keyPoints?: string[]; // Keep for backward compatibility
    actionItems?: Array<{
      title: string;
      owner: string;
      priority: string;
      dueDate?: string;
      context: string;
    }>;
    decisions?: string[];
  };
  hasTranscript: boolean;
  status: 'completed' | 'upcoming' | 'in_progress' | 'processing';
}

export function SimplifiedDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isCurrentUserHost, setIsCurrentUserHost] = useState(false);
  const [participantRefreshTrigger, setParticipantRefreshTrigger] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Persistent caching state using sessionStorage
  const [lastWorkspacesFetch, setLastWorkspacesFetch] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(sessionStorage.getItem('aura-workspaces-fetch-time') || '0', 10);
    }
    return 0;
  });
  const [lastMeetingsFetch, setLastMeetingsFetch] = useState<{[key: string]: number}>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(sessionStorage.getItem('aura-meetings-fetch-times') || '{}');
    }
    return {};
  });
  const [workspacesCache, setWorkspacesCache] = useState<Workspace[]>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(sessionStorage.getItem('aura-workspaces-cache') || '[]');
    }
    return [];
  });
  const [meetingsCache, setMeetingsCache] = useState<{[key: string]: Meeting[]}>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(sessionStorage.getItem('aura-meetings-cache') || '{}');
    }
    return {};
  });
  
  // Usage tracking
  const { usageData, loading: usageLoading, checkBeforeMeeting, refetch: refetchUsage } = useUsageTracking();
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (80 * 4)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Mobile detection and responsive handling
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      // Close mobile sidebar when switching to desktop
      if (!isMobileView) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Sidebar constraints
  const MIN_SIDEBAR_WIDTH = 250;
  const MAX_SIDEBAR_WIDTH = 400;
  
  // Cache settings (optimized for Vercel Free plan)
  const WORKSPACE_CACHE_DURATION = 5 * 60 * 1000;
  const MEETINGS_CACHE_DURATION = 30 * 1000; // 30 seconds - faster updates for processing meetings
  
  // Cache invalidation helper
  const invalidateCache = useCallback((type: 'workspaces' | 'meetings' | 'all', workspaceId?: string) => {
    if (type === 'workspaces' || type === 'all') {
      setLastWorkspacesFetch(0);
      setWorkspacesCache([]);
      // Clear sessionStorage
      sessionStorage.removeItem('aura-workspaces-cache');
      sessionStorage.removeItem('aura-workspaces-fetch-time');
    }
    if (type === 'meetings' || type === 'all') {
      if (workspaceId) {
        const newFetchTimes = { ...lastMeetingsFetch, [workspaceId]: 0 };
        const newCache = { ...meetingsCache };
        delete newCache[workspaceId];
        
        setLastMeetingsFetch(newFetchTimes);
        setMeetingsCache(newCache);
        
        // Update sessionStorage
        sessionStorage.setItem('aura-meetings-fetch-times', JSON.stringify(newFetchTimes));
        sessionStorage.setItem('aura-meetings-cache', JSON.stringify(newCache));
      } else {
        setLastMeetingsFetch({});
        setMeetingsCache({});
        // Clear sessionStorage
        sessionStorage.removeItem('aura-meetings-cache');
        sessionStorage.removeItem('aura-meetings-fetch-times');
      }
    }
  }, [lastMeetingsFetch, meetingsCache]);

  // Load sidebar width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem('aura-sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Save sidebar width to localStorage
  const saveSidebarWidth = useCallback((width: number) => {
    localStorage.setItem('aura-sidebar-width', width.toString());
  }, []);

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Handle mouse move during resize
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    const constrainedWidth = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    setSidebarWidth(constrainedWidth);
  }, [isResizing]);

  // Handle mouse up to end resize
  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveSidebarWidth(sidebarWidth);
    }
  }, [isResizing, sidebarWidth, saveSidebarWidth]);

  // Add global mouse event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (isLoaded && user) {
      // Check if we have valid cached data first
      const now = Date.now();
      const cacheValid = workspacesCache.length > 0 && (now - lastWorkspacesFetch) < WORKSPACE_CACHE_DURATION;
      
      console.log('🔍 Dashboard mount - Cache check:', {
        hasCache: workspacesCache.length > 0,
        lastFetch: lastWorkspacesFetch,
        timeSinceLastFetch: now - lastWorkspacesFetch,
        cacheDuration: WORKSPACE_CACHE_DURATION,
        cacheValid,
        cacheData: workspacesCache.map(w => w.name)
      });
      
      if (cacheValid) {
        console.log('✅ Using cached workspaces data on mount - NO API CALL');
        setWorkspaces(workspacesCache);
        setLoading(false);
      } else {
        console.log('❌ Cache invalid or empty - Making API call');
        fetchWorkspaces();
      }
    }
  }, [isLoaded, user]);

  // Handle workspace selection from URL params or localStorage
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      // Check URL params first
      const urlParams = new URLSearchParams(window.location.search);
      const workspaceFromUrl = urlParams.get('workspace');
      
      // Check localStorage second
      const workspaceFromStorage = localStorage.getItem('aura-selected-workspace');
      
      // Find workspace by ID from URL or localStorage
      const targetWorkspaceId = workspaceFromUrl || workspaceFromStorage;
      const targetWorkspace = targetWorkspaceId 
        ? workspaces.find(w => w.id === targetWorkspaceId)
        : null;
      
      if (targetWorkspace) {
        console.log('Restoring workspace selection:', targetWorkspace.name);
        setSelectedWorkspace(targetWorkspace);
        
        // Clean up URL params after restoration
        if (workspaceFromUrl) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('workspace');
          window.history.replaceState({}, '', newUrl.toString());
        }
      } else {
        // Fallback to first workspace
        setSelectedWorkspace(workspaces[0]);
      }
    }
  }, [workspaces, selectedWorkspace]);

  // Cleanup cache when user navigates away from the app entirely
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear sessionStorage when user closes tab/window
      sessionStorage.removeItem('aura-workspaces-cache');
      sessionStorage.removeItem('aura-workspaces-fetch-time');
      sessionStorage.removeItem('aura-meetings-cache');
      sessionStorage.removeItem('aura-meetings-fetch-times');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      // Check if we have valid cached meetings first
      const now = Date.now();
      const lastFetch = lastMeetingsFetch[selectedWorkspace.id] || 0;
      const cacheValid = meetingsCache[selectedWorkspace.id] && (now - lastFetch) < MEETINGS_CACHE_DURATION;
      
      console.log('🔍 Workspace selection - Meetings cache check:', {
        workspaceId: selectedWorkspace.id,
        hasCache: !!meetingsCache[selectedWorkspace.id],
        lastFetch,
        timeSinceLastFetch: now - lastFetch,
        cacheDuration: MEETINGS_CACHE_DURATION,
        cacheValid
      });
      
      if (cacheValid) {
        console.log('✅ Using cached meetings data - NO API CALL');
        setMeetings(meetingsCache[selectedWorkspace.id]);
      } else {
        console.log('❌ Meetings cache invalid or empty - Making API call');
        fetchMeetingsForWorkspace(selectedWorkspace.id);
      }
      
      checkIfUserIsHost(selectedWorkspace.id);
      // Persist selected workspace to localStorage
      localStorage.setItem('aura-selected-workspace', selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const checkIfUserIsHost = async (workspaceId: string) => {
    if (!user) {
      setIsCurrentUserHost(false);
      return;
    }

    try {
      const response = await fetch(`/api/meetings/${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const workspace = data.data;
          // Check if current user is the creator or a host participant
          const isCreator = workspace.createdBy?.toString() === user.id;
          const isHost = workspace.participants?.some((p: any) => 
            (p.email === user.emailAddresses?.[0]?.emailAddress || p.userId === user.id) && 
            p.role === 'host'
          );
          
          setIsCurrentUserHost(isCreator || isHost);
        }
      }
    } catch (error) {
      console.error('Error checking user host status:', error);
      setIsCurrentUserHost(false);
    }
  };

  const fetchWorkspaces = async (forceRefresh = false) => {
    console.log('🚀 fetchWorkspaces called with forceRefresh:', forceRefresh);
    
    // Check cache first
    const now = Date.now();
    const cacheValid = !forceRefresh && workspacesCache.length > 0 && (now - lastWorkspacesFetch) < WORKSPACE_CACHE_DURATION;
    
    console.log('🔍 fetchWorkspaces - Cache check:', {
      forceRefresh,
      hasCache: workspacesCache.length > 0,
      lastFetch: lastWorkspacesFetch,
      timeSinceLastFetch: now - lastWorkspacesFetch,
      cacheDuration: WORKSPACE_CACHE_DURATION,
      cacheValid
    });
    
    if (cacheValid) {
      console.log('✅ fetchWorkspaces - Using cached data - NO API CALL');
      setWorkspaces(workspacesCache);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching fresh workspaces data');
      const response = await fetch('/api/meetings');
      
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      
      const data = await response.json();
      
      if (data.success) {
        const transformedWorkspaces: Workspace[] = data.data.map((room: any) => ({
          id: room.id,
          objectId: room.objectId,
          name: room.title,
          type: room.type,
          description: room.description,
          participantCount: room.participantCount,
          lastActivity: room.lastActivity,
          recentMeetings: room.recentMeetings,
          isActive: room.isActive
        }));
        
        console.log('Transformed workspaces with participant counts:', transformedWorkspaces.map(w => ({ name: w.name, participantCount: w.participantCount })));
        
        // Update cache and persist to sessionStorage
        setWorkspacesCache(transformedWorkspaces);
        setLastWorkspacesFetch(now);
        
        // Persist to sessionStorage
        sessionStorage.setItem('aura-workspaces-cache', JSON.stringify(transformedWorkspaces));
        sessionStorage.setItem('aura-workspaces-fetch-time', now.toString());
        
        setWorkspaces(transformedWorkspaces);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingsForWorkspace = async (workspaceId: string, forceRefresh = false) => {
    console.log('🚀 fetchMeetingsForWorkspace called:', { workspaceId, forceRefresh });
    
    // Check cache first
    const now = Date.now();
    const lastFetch = lastMeetingsFetch[workspaceId] || 0;
    
    // Check if any cached meeting is in processing state - bypass cache for faster updates
    const hasProcessingMeeting = meetingsCache[workspaceId]?.some((meeting: Meeting) => 
      meeting.status === 'processing'
    );
    
    // Use shorter cache duration for processing meetings
    const effectiveCacheDuration = hasProcessingMeeting ? 10 * 1000 : MEETINGS_CACHE_DURATION; // 10s for processing
    const cacheValid = !forceRefresh && meetingsCache[workspaceId] && (now - lastFetch) < effectiveCacheDuration;
    
    console.log('🔍 fetchMeetingsForWorkspace - Cache check:', {
      workspaceId,
      forceRefresh,
      hasCache: !!meetingsCache[workspaceId],
      lastFetch,
      timeSinceLastFetch: now - lastFetch,
      cacheDuration: MEETINGS_CACHE_DURATION,
      cacheValid
    });
    
    if (cacheValid) {
      console.log(`✅ fetchMeetingsForWorkspace - Using cached data - NO API CALL for: ${workspaceId}`);
      setMeetings(meetingsCache[workspaceId]);
      return;
    }

    try {
      console.log(`Fetching fresh meetings data for workspace: ${workspaceId}`);
      
      // Fetch both historical meetings and current room status (including active meeting)
      const [historyResponse, roomResponse] = await Promise.all([
        fetch(`/api/meetings/${workspaceId}/history`),
        fetch(`/api/meetings/${workspaceId}`)
      ]);
      
      if (!historyResponse.ok) throw new Error('Failed to fetch meeting history');
      if (!roomResponse.ok) throw new Error('Failed to fetch room status');
      
      const [historyData, roomData] = await Promise.all([
        historyResponse.json(),
        roomResponse.json()
      ]);
      
      if (historyData.success && roomData.success) {
        // Transform historical meetings
        const historicalMeetings: Meeting[] = historyData.data.map((meeting: any) => ({
          id: meeting.id || meeting._id,
          title: meeting.title || meeting.type,
          type: meeting.type,
          date: new Date(meeting.startTime || meeting.startedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          startTime: meeting.startTime || meeting.startedAt,
          duration: meeting.duration ? `${meeting.duration} min` : undefined,
          participants: meeting.participants?.map((p: any) => ({
            name: p.name,
            avatar: p.avatar
          })) || [],
          summary: meeting.summary,
          hasTranscript: meeting.hasTranscripts || false,
          // Use the actual status from the database, with proper fallbacks
          status: meeting.status === 'active' ? 'in_progress' :
                  meeting.status === 'processing' ? 'processing' :
                  meeting.status === 'ended' ? 'completed' :
                  meeting.status === 'completed' ? 'completed' :
                  meeting.isActive ? 'in_progress' : 
                  meeting.isUpcoming ? 'upcoming' : 
                  'completed'
        }));

        // Check for active meeting and add/update it
        let transformedMeetings = [...historicalMeetings];
        
        if (roomData.data.hasActiveMeeting && roomData.data.activeMeeting) {
          const activeMeeting = roomData.data.activeMeeting;
          
          // Determine the correct status and title based on meeting state
          const meetingStatus = activeMeeting.status === 'active' ? 'in_progress' : 
                               activeMeeting.status === 'processing' ? 'processing' : 'in_progress';
          const meetingTitle = activeMeeting.status === 'processing' ? 
                              (activeMeeting.title === 'Meeting in progress' ? 'Processing Meeting Summary' : activeMeeting.title) :
                              (activeMeeting.title || 'Meeting in progress');
          const meetingDuration = activeMeeting.status === 'processing' ? 
                                 `${activeMeeting.duration} min` : 
                                 `${activeMeeting.duration} min (ongoing)`;
          
          const activeMeetingTransformed: Meeting = {
            id: activeMeeting.id,
            title: meetingTitle,
            type: activeMeeting.type,
            date: new Date(activeMeeting.startedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            startTime: activeMeeting.startedAt,
            duration: meetingDuration,
            participants: [], // Will be populated from room data if available
            summary: undefined,
            hasTranscript: false,
            status: meetingStatus
          };

          // Remove any existing meeting with the same ID and add the active one at the top
          transformedMeetings = transformedMeetings.filter(m => m.id !== activeMeeting.id);
          transformedMeetings.unshift(activeMeetingTransformed);
        }
        
        // Update cache and persist to sessionStorage
        const newMeetingsCache = {
          ...meetingsCache,
          [workspaceId]: transformedMeetings
        };
        const newFetchTimes = {
          ...lastMeetingsFetch,
          [workspaceId]: now
        };
        
        setMeetingsCache(newMeetingsCache);
        setLastMeetingsFetch(newFetchTimes);
        
        // Persist to sessionStorage
        sessionStorage.setItem('aura-meetings-cache', JSON.stringify(newMeetingsCache));
        sessionStorage.setItem('aura-meetings-fetch-times', JSON.stringify(newFetchTimes));
        
        setMeetings(transformedMeetings);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    }
  };

  const handleCreateWorkspace = () => {
    // TODO: Implement create workspace modal
    console.log('Create new workspace');
  };

  const handleMeetingClick = (meeting: Meeting) => {
    // Navigate to meeting summary view with workspace context
    const workspaceParam = selectedWorkspace ? `?workspace=${selectedWorkspace.id}` : '';
    router.push(`/meeting/${meeting.id}${workspaceParam}`);
  };

  const handleJoinWorkspace = async (workspaceId: string) => {
    // Check usage limits before allowing user to join
    const canJoin = await checkBeforeMeeting();
    
    if (!canJoin && usageData && usageData.exceeded) {
      // Show paywall modal
      setIsPaywallOpen(true);
      return;
    }
    
    // User can join the meeting
    router.push(`/rooms/${workspaceId}`);
  };



  if (!isLoaded) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="h-8 w-8"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </Button>
            <h1 className="text-lg font-semibold">
              {selectedWorkspace?.name || 'Aura'}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsWorkspaceSettingsOpen(true)}
            className="h-8 w-8"
            title="Workspace Settings"
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div 
            className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-card border-r border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Workspaces</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="h-8 w-8"
              >
                <X size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <WorkspaceSidebar
                workspaces={workspaces}
                selectedWorkspace={selectedWorkspace}
                onSelectWorkspace={(workspace) => {
                  setSelectedWorkspace(workspace);
                  if (workspace) {
                    localStorage.setItem('aura-selected-workspace', workspace.id);
                  }
                  setIsMobileSidebarOpen(false); // Close mobile sidebar after selection
                }}
                onCreateWorkspace={handleCreateWorkspace}
                onWorkspaceCreated={() => fetchWorkspaces(true)}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      {!isMobile && (
        <div 
          ref={sidebarRef}
          className="bg-card border-r border-border flex flex-col relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <WorkspaceSidebar
            workspaces={workspaces}
            selectedWorkspace={selectedWorkspace}
            onSelectWorkspace={(workspace) => {
              setSelectedWorkspace(workspace);
              // Also persist the selection immediately
              if (workspace) {
                localStorage.setItem('aura-selected-workspace', workspace.id);
              }
            }}
            onCreateWorkspace={handleCreateWorkspace}
            onWorkspaceCreated={() => fetchWorkspaces(true)}
            loading={loading}
          />
          
          {/* Resize Handle - Desktop only */}
          <div
            className={cn(
              "absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors",
              isResizing && "bg-primary"
            )}
            onMouseDown={handleResizeStart}
            title="Drag to resize sidebar"
          />
        </div>
      )}

      {/* Main Content Area - Meeting Database */}
      <div className={cn(
        "flex-1 flex flex-col",
        isMobile && "pt-16" // Add top padding for mobile header
      )}>
        <MeetingDatabase
          workspace={selectedWorkspace}
          meetings={meetings}
          onMeetingClick={handleMeetingClick}
          onJoinWorkspace={handleJoinWorkspace}
          onOpenSettings={() => setIsWorkspaceSettingsOpen(true)}
          onOpenTasks={() => setIsTasksOpen(true)}
          onRefreshMeetings={() => selectedWorkspace && fetchMeetingsForWorkspace(selectedWorkspace.id, true)}
          loading={loading}
          isCurrentUserHost={isCurrentUserHost}
          refreshTrigger={participantRefreshTrigger}
        />
      </div>

      {/* AI Chat Bubble - Responsive */}
      <div className={cn(
        "fixed z-50",
        isMobile ? "bottom-6 right-4" : "bottom-6 right-6"
      )}>
        <Button
          onClick={() => setIsAiChatOpen(!isAiChatOpen)}
          size={isMobile ? "icon" : "lg"}
          className={cn(
            "rounded-full shadow-lg flex items-center gap-2",
            isMobile ? "h-12 w-12" : "px-4 py-3 h-auto"
          )}
          title="Ask Aura AI Assistant"
        >
          <MessageSquare size={isMobile ? 20 : 20} />
          {!isMobile && <span className="text-sm font-medium">Ask Aura</span>}
        </Button>
      </div>

      {/* User Settings Bubble - Responsive positioning */}
      <div className={cn(
        "fixed z-50",
        isMobile ? "bottom-6 left-4" : "bottom-6 left-6"
      )}>
        <Button
          variant="outline"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={cn(
            "rounded-full shadow-lg flex items-center gap-2",
            isMobile ? "p-2" : "p-3"
          )}
          title={user.fullName || 'User Settings'}
        >
          {user.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt={user.fullName || 'User'} 
              className={cn(
                "rounded-full object-cover",
                isMobile ? "w-8 h-8" : "w-6 h-6"
              )}
            />
          ) : (
          <div className={cn(
            "bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium",
            isMobile ? "w-8 h-8" : "w-6 h-6"
          )}>
            {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
          </div>
          )}
          <span className="text-sm font-medium hidden sm:block">
            {user.firstName || 'User'}
          </span>
        </Button>
      </div>

      {/* AI Chat Panel */}
      {isAiChatOpen && (
        <AiChatPanel
          workspace={selectedWorkspace}
          onClose={() => setIsAiChatOpen(false)}
        />
      )}

      {/* User Settings Panel */}
      {isUserMenuOpen && (
        <UserSettingsBubble
          user={user}
          onClose={() => setIsUserMenuOpen(false)}
          onOpenBilling={() => setIsBillingOpen(true)}
          onOpenIntegrations={() => setIsIntegrationsOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />
      )}

      {/* Workspace Settings Modal */}
      {isWorkspaceSettingsOpen && selectedWorkspace && (
        <WorkspaceSettings
          workspace={selectedWorkspace}
          onClose={() => setIsWorkspaceSettingsOpen(false)}
          onWorkspaceUpdated={() => {
            fetchWorkspaces(true); // Force refresh workspaces
            // Also refresh the current workspace meetings and participants
            if (selectedWorkspace) {
              fetchMeetingsForWorkspace(selectedWorkspace.id, true); // Force refresh meetings
              setParticipantRefreshTrigger(prev => prev + 1);
            }
            setIsWorkspaceSettingsOpen(false);
          }}
          onWorkspaceDeleted={() => {
            setSelectedWorkspace(null);
            fetchWorkspaces(true); // Force refresh workspaces
            setIsWorkspaceSettingsOpen(false);
          }}
        />
      )}

      {/* Billing Modal */}
      {isBillingOpen && (
        <BillingModal
          onClose={() => setIsBillingOpen(false)}
        />
      )}

      {/* Integrations Modal */}
      {isIntegrationsOpen && (
        <IntegrationsModal
          onClose={() => setIsIntegrationsOpen(false)}
        />
      )}

      {/* Help Support Modal */}
      {isHelpOpen && (
        <HelpSupportModal
          onClose={() => setIsHelpOpen(false)}
        />
      )}

      {/* Paywall Modal */}
      {isPaywallOpen && usageData && (
        <PaywallModal
          onClose={() => setIsPaywallOpen(false)}
          currentCount={usageData.currentCount}
          limit={usageData.limit}
        />
      )}

      {/* Task Management Panel */}
      {isTasksOpen && selectedWorkspace && (
        <TaskManagementPanel
          workspaceId={selectedWorkspace.objectId}
          workspaceName={selectedWorkspace.name}
          onClose={() => setIsTasksOpen(false)}
        />
      )}
    </div>
  );
} 