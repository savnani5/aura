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
import { Plus, MessageSquare, Settings, User, Users, MoreHorizontal } from 'lucide-react';
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
  status: 'completed' | 'upcoming' | 'in_progress';
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
  
  // Usage tracking
  const { usageData, loading: usageLoading, checkBeforeMeeting, refetch: refetchUsage } = useUsageTracking();
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (80 * 4)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Sidebar constraints
  const MIN_SIDEBAR_WIDTH = 250;
  const MAX_SIDEBAR_WIDTH = 400;

  // Load sidebar width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem('ohm-sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Save sidebar width to localStorage
  const saveSidebarWidth = useCallback((width: number) => {
    localStorage.setItem('ohm-sidebar-width', width.toString());
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
      fetchWorkspaces();
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchMeetingsForWorkspace(selectedWorkspace.id);
      checkIfUserIsHost(selectedWorkspace.id);
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

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
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
        
        setWorkspaces(transformedWorkspaces);
        
        // Auto-select first workspace if none selected
        if (!selectedWorkspace && transformedWorkspaces.length > 0) {
          setSelectedWorkspace(transformedWorkspaces[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingsForWorkspace = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/meetings/${workspaceId}/history`);
      
      if (!response.ok) throw new Error('Failed to fetch meetings');
      
      const data = await response.json();
      
      if (data.success) {
        const transformedMeetings: Meeting[] = data.data.map((meeting: any) => ({
          id: meeting.id || meeting._id,
          title: meeting.title || meeting.type,
          type: meeting.type,
          date: new Date(meeting.startTime || meeting.startedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          startTime: meeting.startTime || meeting.startedAt, // Add startTime for proper grouping
          duration: meeting.duration ? `${meeting.duration} min` : undefined,
          participants: meeting.participants?.map((p: any) => ({
            name: p.name,
            avatar: p.avatar
          })) || [],
          summary: meeting.summary, // Pass the full summary object
          hasTranscript: meeting.hasTranscripts || false,
          status: meeting.isUpcoming ? 'upcoming' : 
                   meeting.endedAt ? 'completed' : 'in_progress'
        }));
        
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
    // Navigate to meeting summary view
    router.push(`/meeting/${meeting.id}`);
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
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar - Workspaces with Resizable Handle */}
      <div 
        ref={sidebarRef}
        className="bg-card border-r border-border flex flex-col relative"
        style={{ width: `${sidebarWidth}px` }}
      >
        <WorkspaceSidebar
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={setSelectedWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          onWorkspaceCreated={fetchWorkspaces}
          loading={loading}
        />
        
        {/* Resize Handle */}
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleResizeStart}
          title="Drag to resize sidebar"
        />
      </div>

      {/* Main Content Area - Meeting Database */}
      <div className="flex-1 flex flex-col">
        <MeetingDatabase
          workspace={selectedWorkspace}
          meetings={meetings}
          onMeetingClick={handleMeetingClick}
          onJoinWorkspace={handleJoinWorkspace}
          onOpenSettings={() => setIsWorkspaceSettingsOpen(true)}
          onOpenTasks={() => setIsTasksOpen(true)}
          onRefreshMeetings={() => selectedWorkspace && fetchMeetingsForWorkspace(selectedWorkspace.id)}
          loading={loading}
          isCurrentUserHost={isCurrentUserHost}
          refreshTrigger={participantRefreshTrigger}
        />
      </div>

      {/* Bottom Right - AI Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsAiChatOpen(!isAiChatOpen)}
          size="lg"
          className="rounded-full px-4 py-3 h-auto shadow-lg flex items-center gap-2"
          title="Ask Ohm AI Assistant"
        >
          <MessageSquare size={20} />
          <span className="text-sm font-medium">Ask Ohm</span>
        </Button>
      </div>

      {/* Bottom Left - User Settings Bubble */}
      <div className="fixed bottom-6 left-6 z-50">
        <Button
          variant="outline"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="rounded-full p-3 shadow-lg flex items-center gap-2"
          title={user.fullName || 'User Settings'}
        >
          {user.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt={user.fullName || 'User'} 
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
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
            fetchWorkspaces();
            // Also refresh the current workspace meetings and participants
            if (selectedWorkspace) {
              fetchMeetingsForWorkspace(selectedWorkspace.id);
              setParticipantRefreshTrigger(prev => prev + 1);
            }
            setIsWorkspaceSettingsOpen(false);
          }}
          onWorkspaceDeleted={() => {
            setSelectedWorkspace(null);
            fetchWorkspaces();
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