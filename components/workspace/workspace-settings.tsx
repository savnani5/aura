'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
  type: string;
  description?: string;
  participantCount: number;
  lastActivity: string;
  recentMeetings: number;
  isActive: boolean;
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

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onClose: () => void;
  onWorkspaceUpdated: () => void;
  onWorkspaceDeleted?: () => void;
}

interface WorkspaceSettingsForm {
  name: string;
  type: string;
  description: string;
  participants: Array<{
    id?: string;
    name: string;
    email: string;
    role: string;
  }>;
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

export function WorkspaceSettings({ workspace, onClose, onWorkspaceUpdated, onWorkspaceDeleted }: WorkspaceSettingsProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Delete functionality states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [form, setForm] = useState<WorkspaceSettingsForm>({
    name: workspace.name || '',
    type: workspace.type || '',
    description: workspace.description || '',
    participants: workspace.participants?.map(p => ({
      id: p._id,
      name: p.name,
      email: p.email,
      role: p.role
    })) || [],
  });

  const fetchWorkspaceDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const detailedWorkspace = data.data;
      setForm({
        name: workspace.name || '',
        type: workspace.type || '',
        description: workspace.description || '',
            participants: detailedWorkspace.participants?.map((p: any) => ({
          id: p._id,
          name: p.name,
          email: p.email,
          role: p.role
        })) || [],
      });
    }
      }
    } catch (error) {
      console.error('Error fetching workspace details:', error);
      // Fallback to basic workspace data
      setForm({
        name: workspace.name || '',
        type: workspace.type || '',
        description: workspace.description || '',
        participants: [],
      });
    }
  }, [workspace]);

  // Initialize form with workspace data and fetch detailed workspace info
  useEffect(() => {
    if (workspace) {
      fetchWorkspaceDetails();
    }
  }, [workspace, fetchWorkspaceDetails]);

  const handleInputChange = (field: keyof WorkspaceSettingsForm, value: any) => {
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

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/meetings/${workspace.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.name.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
          participants: form.participants.filter(p => p.email.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }

      const data = await response.json();
      console.log('Workspace updated:', data);

      setHasChanges(false);
      onWorkspaceUpdated();
      
      // Show success message
      alert('Workspace updated successfully!');
    } catch (error) {
      console.error('Error updating workspace:', error);
      alert('Failed to update workspace. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (workspace) {
      setForm({
        name: workspace.name || '',
        type: workspace.type || '',
        description: workspace.description || '',
        participants: workspace.participants?.map(p => ({
          id: p._id,
          name: p.name,
          email: p.email,
          role: p.role
        })) || [],
      });
      setHasChanges(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteConfirmText !== workspace.name) {
      alert('Please type the exact workspace name to confirm deletion');
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/meetings/${workspace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete workspace');
      }

      const data = await response.json();
      console.log('Workspace deleted:', data);

      // Show success message
      alert(`Workspace deleted successfully! Removed:
• ${data.deletedCounts.room} workspace
• ${data.deletedCounts.meetings} meetings  
• ${data.deletedCounts.tasks} tasks
• ${data.deletedCounts.embeddings} embeddings`);

      // Redirect to dashboard
      if (onWorkspaceDeleted) {
        onWorkspaceDeleted();
      } else {
        // Fallback redirect
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert(`Failed to delete workspace: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  };

  // Find current user in participants to show as host
  const currentUserEmail = user?.emailAddresses[0]?.emailAddress;
  const hostParticipant = form.participants.find(p => p.role === 'host');
  const regularParticipants = form.participants.filter(p => p.role !== 'host');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">Workspace Settings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your workspace details and participants
            </p>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Unsaved changes</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Workspace Name *
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Product Team Workspace"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-medium">
                Workspace Type *
              </label>
              <div className="relative">
                <input
                  id="type"
                  type="text"
                  value={form.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  placeholder="Enter or select workspace type"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => setShowTypeDropdown(true)}
                  autoComplete="off"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
                
                {showTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10">
                    {MEETING_TYPE_SUGGESTIONS.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => selectMeetingType(type)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional description for this workspace"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Participants */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Participants</h3>
            
            <div className="space-y-3">
              {/* Host participant - Read-only */}
              {hostParticipant && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                  <div className="flex-1 flex gap-3">
                    <div className="flex-1 px-3 py-2 bg-muted-foreground/5 border border-border rounded-md text-sm text-muted-foreground">
                      {hostParticipant.name || 'Host'}
                    </div>
                    <div className="flex-1 px-3 py-2 bg-muted-foreground/5 border border-border rounded-md text-sm text-muted-foreground">
                      {hostParticipant.email || 'host@example.com'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    <Star size={12} />
                    Host
                  </div>
                </div>
              )}
              
              {/* Regular participants */}
              {regularParticipants.map((participant, index) => {
                const actualIndex = form.participants.findIndex(p => p === participant);
                return (
                  <div key={actualIndex} className="flex items-center gap-3">
                    <div className="flex-1 flex gap-3">
                      <input
                        type="text"
                        value={participant.name}
                        onChange={(e) => updateParticipant(actualIndex, 'name', e.target.value)}
                        placeholder="Participant name"
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                      />
                      <input
                        type="email"
                        value={participant.email}
                        onChange={(e) => updateParticipant(actualIndex, 'email', e.target.value)}
                        placeholder="participant@example.com"
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParticipant(actualIndex)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                );
              })}
              
              <Button
                type="button"
                variant="outline"
                onClick={addParticipant}
                className="w-full"
              >
                <Plus size={16} className="mr-2" />
                Add Participant
              </Button>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-destructive">⚠️ Danger Zone</h3>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Delete this workspace permanently. This action cannot be undone and will remove:
              </p>
              <ul className="text-sm text-muted-foreground ml-4 space-y-1">
                <li>• The workspace and all settings</li>
                <li>• All meeting transcripts and recordings</li>
                <li>• All task assignments and history</li>
                <li>• All AI-generated embeddings and summaries</li>
              </ul>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 size={16} className="mr-2" />
                Delete Workspace
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Actions */}
        <div className="flex justify-between p-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset Changes
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !hasChanges || !form.name.trim() || !form.type.trim()}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelDelete}
          />
          <Card className="relative w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">
                ⚠️ Delete Workspace
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete the &ldquo;{workspace.name}&rdquo; workspace and all associated data.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Please type <strong>{workspace.name}</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type workspace name here..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                  autoFocus
                />
              </div>
            </CardContent>
            
            <div className="flex justify-end gap-3 p-6 border-t border-border">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== workspace.name}
              >
                {isDeleting ? 'Deleting...' : 'Delete Workspace'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
} 