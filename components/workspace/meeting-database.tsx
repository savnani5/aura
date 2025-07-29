'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, FileText, MoreHorizontal, Video, Settings, Copy, Check, Edit2, Link, X, CheckSquare, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

interface Meeting {
  id: string;
  title: string;
  type: string;
  date: string;
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
  startTime?: string; // Add this for proper date parsing
  isLive?: boolean;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
  isHost: boolean;
}

interface MeetingDatabaseProps {
  workspace: Workspace | null;
  meetings: Meeting[];
  onMeetingClick: (meeting: Meeting) => void;
  onJoinWorkspace: (workspaceId: string) => void;
  onOpenSettings: () => void;
  onOpenTasks?: () => void;
  onRefreshMeetings?: () => void;
  loading: boolean;
  isCurrentUserHost: boolean;
  refreshTrigger?: number; // Add trigger to refresh participants
}

interface GroupedMeetings {
  [date: string]: Meeting[];
}

export function MeetingDatabase({
  workspace,
  meetings,
  onMeetingClick,
  onJoinWorkspace,
  onOpenSettings,
  onOpenTasks,
  onRefreshMeetings,
  loading,
  isCurrentUserHost,
  refreshTrigger
}: MeetingDatabaseProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(30); // Initial limit of 30 meetings
  const [showAll, setShowAll] = useState(false);

  // Group meetings by date
  const groupedMeetings = useMemo(() => {
    const groups: GroupedMeetings = {};
    
    meetings.forEach(meeting => {
      // Parse the date properly
      const meetingDate = meeting.startTime ? new Date(meeting.startTime) : new Date(meeting.date);
      const dateKey = meetingDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(meeting);
    });

    // Sort meetings within each group by time (most recent first)
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => {
        const dateA = a.startTime ? new Date(a.startTime) : new Date(a.date);
        const dateB = b.startTime ? new Date(b.startTime) : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
    });

    return groups;
  }, [meetings]);

  // Sort date groups (most recent first)
  const sortedDateGroups = useMemo(() => {
    return Object.keys(groupedMeetings).sort((a, b) => {
      const dateA = new Date(groupedMeetings[a][0].startTime || groupedMeetings[a][0].date);
      const dateB = new Date(groupedMeetings[b][0].startTime || groupedMeetings[b][0].date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupedMeetings]);

  // Calculate displayed meetings with pagination
  const { displayedDateGroups, totalMeetings, displayedMeetings, hasMore } = useMemo(() => {
    const total = meetings.length;
    
    if (showAll || total <= displayLimit) {
      return {
        displayedDateGroups: sortedDateGroups,
        totalMeetings: total,
        displayedMeetings: total,
        hasMore: false
      };
    }

    // Flatten meetings to apply limit, then regroup
    const allMeetingsFlat: Array<{ meeting: Meeting; dateKey: string }> = [];
    sortedDateGroups.forEach(dateKey => {
      groupedMeetings[dateKey].forEach(meeting => {
        allMeetingsFlat.push({ meeting, dateKey });
      });
    });

    const limitedMeetings = allMeetingsFlat.slice(0, displayLimit);
    const limitedGroups: GroupedMeetings = {};
    const limitedDateGroups: string[] = [];

    limitedMeetings.forEach(({ meeting, dateKey }) => {
      if (!limitedGroups[dateKey]) {
        limitedGroups[dateKey] = [];
        limitedDateGroups.push(dateKey);
      }
      limitedGroups[dateKey].push(meeting);
    });

    // Maintain original date order
    const orderedLimitedDateGroups = sortedDateGroups.filter(date => limitedDateGroups.includes(date));

    return {
      displayedDateGroups: orderedLimitedDateGroups,
      totalMeetings: total,
      displayedMeetings: limitedMeetings.length,
      hasMore: total > displayLimit
    };
  }, [meetings, sortedDateGroups, groupedMeetings, displayLimit, showAll]);

  // Fetch participants when workspace changes
  useEffect(() => {
    if (workspace) {
      fetchParticipants();
    }
  }, [workspace, refreshTrigger]);

  // Reset pagination when workspace changes
  useEffect(() => {
    setShowAll(false);
  }, [workspace]);

  const fetchParticipants = async () => {
    if (!workspace) return;
    
    setParticipantsLoading(true);
    try {
      const response = await fetch(`/api/meetings/${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.participants) {
          // Transform participants to match the expected format
          const transformedParticipants = data.data.participants.map((participant: any) => ({
            id: participant.userId || participant.name.toLowerCase().replace(/\s+/g, '-'),
            name: participant.name,
            email: participant.email,
            role: participant.role,
            joinedAt: participant.joinedAt,
            isOnline: Math.random() > 0.3, // Mock online status - 70% chance online
            isHost: participant.role === 'host'
          }));
          setParticipants(transformedParticipants);
        }
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

    // Generate smart title from summary or fallback to timestamp
  const generateSmartTitle = (meeting: Meeting): string => {
    // First priority: AI-generated title from summary
    if (meeting.summary?.title && meeting.summary.title !== meeting.type) {
      return meeting.summary.title;
    }

    // Second priority: If meeting already has a title (from AI), use it
    if (meeting.title && meeting.title !== meeting.type) {
      return meeting.title;
    }

    // Third priority: Extract from summary content
    if (meeting.summary?.content) {
      // Extract first meaningful sentence from summary
      const sentences = meeting.summary.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      if (sentences.length > 0) {
        const firstSentence = sentences[0].trim();
        // Limit to 50 characters for compact display
        return firstSentence.length > 50 ? firstSentence.substring(0, 47) + '...' : firstSentence;
      }
    }

    // Fallback to type-based title
    return meeting.type;
  };

  const copyMeetingLink = async (workspaceId: string) => {
    try {
      const meetingUrl = `${window.location.origin}/rooms/${workspaceId}`;
      await navigator.clipboard.writeText(meetingUrl);
      setCopiedLink(workspaceId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${meetingTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/meeting-details/${meetingId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Refresh meetings list
        onRefreshMeetings?.();
      } else {
        alert(`Failed to delete meeting: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting. Please try again.');
    }
  };

  const handleEditTitle = (meeting: Meeting) => {
    setEditingMeeting(meeting.id);
    setEditTitle(meeting.title);
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editTitle.trim() || savingTitle) return;
    
    setSavingTitle(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle.trim()
        }),
      });

      if (response.ok) {
        // Close edit mode and refresh meetings
        setEditingMeeting(null);
        setEditTitle('');
        // Trigger refetch of meetings
        if (onRefreshMeetings) {
          onRefreshMeetings();
        }
      } else {
        throw new Error('Failed to update title');
      }
    } catch (error) {
      console.error('Error updating meeting title:', error);
      alert('Failed to update meeting title. Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMeeting(null);
    setEditTitle('');
  };

  const formatTime = (meeting: Meeting): string => {
    const date = meeting.startTime ? new Date(meeting.startTime) : new Date(meeting.date);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!workspace) {
    return (
      <div className="h-full flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">
            <Calendar size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Select a workspace</h3>
          <p className="text-muted-foreground">Choose a workspace from the sidebar to view its meetings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">{workspace.name}</h1>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-muted-foreground">
                {workspace.type} • {workspace.participantCount} participant{workspace.participantCount !== 1 ? 's' : ''}
              </p>
              
              {/* Participant avatars */}
              {participants.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1">
                    {participants.slice(0, 3).map((participant) => (
                      <div
                        key={participant.id}
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border border-background",
                          participant.isOnline 
                            ? "bg-green-100 text-green-800" 
                            : "bg-muted text-muted-foreground"
                        )}
                        title={`${participant.name} (${participant.role}${participant.isOnline ? ' - Online' : ' - Offline'})`}
                      >
                        {getInitials(participant.name)}
                      </div>
                    ))}
                    {participants.length > 3 && (
                      <div className="w-6 h-6 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-xs font-medium border border-background">
                        +{participants.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Copy Meeting Link Button */}
            <Button
              variant="outline"
              onClick={() => copyMeetingLink(workspace.id)}
              className="gap-2"
              title="Copy meeting link"
            >
              {copiedLink === workspace.id ? (
                <>
                  <Check size={16} className="text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Link size={16} />
                  Copy Link
                </>
              )}
            </Button>
            
            {/* Tasks Button */}
            {onOpenTasks && (
              <Button
                variant="outline"
                onClick={onOpenTasks}
                className="gap-2"
                title="Manage tasks"
              >
                <CheckSquare size={16} />
                Tasks
              </Button>
            )}
            
            {/* Join Meeting Button */}
            <Button
              onClick={() => onJoinWorkspace(workspace.id)}
              className="gap-2"
            >
              <Video size={16} />
              Join Meeting
            </Button>
            
            {/* Workspace Settings - Only show for hosts */}
            {isCurrentUserHost && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              title="Workspace settings"
            >
              <MoreHorizontal size={20} />
            </Button>
            )}
          </div>
        </div>
      </div>

      {/* Meeting List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6">
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-muted rounded w-24 mb-3"></div>
                  <div className="space-y-2">
                    {[...Array(2)].map((_, j) => (
                      <div key={j} className="animate-pulse flex items-center space-x-3 py-2">
                        <div className="w-8 h-8 bg-muted rounded-lg"></div>
                    <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-48 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-32"></div>
                    </div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : meetings.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
              <div className="text-muted-foreground mb-6">
                <Calendar size={64} className="mx-auto" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-3">No meetings yet</h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Start your first meeting in this workspace to see it here. All your meeting history, transcripts, and summaries will appear in this space.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => copyMeetingLink(workspace.id)}
                  variant="outline"
                  className="gap-2"
                >
                  {copiedLink === workspace.id ? (
                    <>
                      <Check size={16} className="text-green-600" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Link size={16} />
                      Copy Link
                    </>
                  )}
                </Button>
              <Button
                onClick={() => onJoinWorkspace(workspace.id)}
                className="gap-2"
              >
                <Video size={16} />
                Start Meeting
              </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-6">
              {displayedDateGroups.map((dateGroup) => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className="text-sm font-medium text-muted-foreground mb-3">
                    {dateGroup}
                  </div>
                  
                  {/* Meetings for this date */}
                  <div className="space-y-1">
                    {groupedMeetings[dateGroup].map((meeting) => (
                <div
                  key={meeting.id}
                        className="flex items-center space-x-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-all duration-200 group cursor-pointer"
                        onClick={() => editingMeeting !== meeting.id && onMeetingClick(meeting)}
                >
                    {/* Meeting Icon */}
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-muted/80 transition-colors">
                          <FileText size={14} className="text-muted-foreground" />
                    </div>
                    
                    {/* Meeting Info */}
                    <div className="flex-1 min-w-0">
                          {editingMeeting === meeting.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 text-sm font-medium bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveTitle(meeting.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                disabled={savingTitle}
                              />
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveTitle(meeting.id);
                                }}
                                disabled={!editTitle.trim() || savingTitle}
                                className="h-6 px-2"
                              >
                                {savingTitle ? (
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                disabled={savingTitle}
                                className="h-6 px-2"
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {generateSmartTitle(meeting)}
                      </h3>
                                <p className="text-xs text-muted-foreground truncate">
                                  {meeting.participants.map(p => p.name).join(', ')}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTitle(meeting);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                title="Edit title"
                              >
                                <Edit2 size={12} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMeeting(meeting.id, generateSmartTitle(meeting));
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-destructive hover:text-destructive"
                                title="Delete meeting"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {/* Status and Time */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {meeting.status === 'in_progress' && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-xs font-medium text-red-600">LIVE</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground font-medium">
                            {formatTime(meeting)}
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                          </div>
                        ))}
              
              {/* Show More Button */}
              {hasMore && (
                <div className="pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Showing {displayedMeetings} of {totalMeetings} meetings
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowAll(true)}
                      className="gap-2"
                    >
                      <ChevronDown size={16} />
                      Show All {totalMeetings} Meetings
                    </Button>
                  </div>
                          </div>
                        )}
              
              {/* Show Less Button (when showing all) */}
              {showAll && totalMeetings > displayLimit && (
                <div className="pt-4 border-t border-border">
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAll(false)}
                      className="gap-2 text-muted-foreground"
                    >
                      <ChevronUp size={16} />
                      Show Less
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 