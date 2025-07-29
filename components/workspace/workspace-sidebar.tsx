'use client';

import React, { useState } from 'react';
import { Plus, Folder, Users, Clock, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onWorkspaceCreated: () => void;
  loading: boolean;
}

export function WorkspaceSidebar({
  workspaces,
  selectedWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onWorkspaceCreated,
  loading
}: WorkspaceSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateWorkspace = () => {
    setIsCreating(true);
    setNewWorkspaceName('');
  };

  const handleSaveWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Generate room ID from title
      const roomId = newWorkspaceName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30) + '-' + Date.now().toString(36);

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomId,
          title: newWorkspaceName.trim(),
          type: 'Meeting',
          isRecurring: true,
          participants: []
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      // Reset form and notify parent
      setIsCreating(false);
      setNewWorkspaceName('');
      onWorkspaceCreated();
      
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewWorkspaceName('');
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Workspaces</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCreateWorkspace}
            title="Create new workspace"
            disabled={isCreating}
            className="h-7 w-7"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-3 p-3">
                    <div className="w-10 h-10 bg-muted rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Show empty state when no workspaces and not creating */}
            {workspaces.length === 0 && !isCreating && (
          <div className="p-6 text-center">
            <div className="text-muted-foreground mb-4">
              <Folder size={48} className="mx-auto" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first workspace to get started with team collaboration.
            </p>
                <Button onClick={handleCreateWorkspace} className="gap-2">
              <Plus size={16} />
              Create Workspace
            </Button>
          </div>
            )}
            
            {/* Inline workspace creation */}
            {isCreating && (
              <div className="mb-2 p-2 border border-border rounded-lg bg-accent/50">
                <div className="flex items-center space-x-2">
                  {/* Workspace Icon Placeholder */}
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Plus size={14} className="text-muted-foreground" />
                  </div>
                  
                  {/* Input and Actions */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="Workspace name..."
                      className="w-full text-sm font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground"
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveWorkspace();
                        } else if (e.key === 'Escape') {
                          handleCancelCreate();
                        }
                      }}
                      disabled={isLoading}
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveWorkspace}
                        disabled={!newWorkspaceName.trim() || isLoading}
                        className="h-5 px-2 text-xs"
                      >
                        <Check size={10} className="mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelCreate}
                        disabled={isLoading}
                        className="h-5 px-2 text-xs"
                      >
                        <X size={10} className="mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {workspaces.map((workspace) => (
              <Button
                key={workspace.id}
                variant="ghost"
                onClick={() => onSelectWorkspace(workspace)}
                className={cn(
                  "w-full justify-start p-2 h-auto mb-1",
                  selectedWorkspace?.id === workspace.id && "bg-accent border border-border"
                )}
              >
                <div className="flex items-center space-x-2">
                  {/* Workspace Icon */}
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Workspace Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {workspace.name}
                      </h3>
                      {workspace.isActive && (
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Users size={10} className="mr-1" />
                      <span className="mr-2">{workspace.participantCount}</span>
                      <Clock size={10} className="mr-1" />
                      <span>{formatLastActivity(workspace.lastActivity)}</span>
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
} 