'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CheckSquare, AlertCircle, Clock, User, Calendar, Download, Filter, Search, ChevronDown, Check, Trash2, Undo2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Task {
  _id: string;
  roomId: string;
  meetingId?: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewStatus?: 'pending_review' | 'reviewed' | 'exported';
  assignedToName?: string;
  dueDate?: string;
  meetingTitle?: string;
  meetingDate?: string;
  isAiGenerated: boolean;
  createdAt: string;
}

interface TaskManagementPanelProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export function TaskManagementPanel({ workspaceId, workspaceName, onClose }: TaskManagementPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending_review' | 'reviewed' | 'archived'>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [filterPriority, setFilterPriority] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    assignedToName: '',
    dueDate: ''
  });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, filterStatus, filterPriority, searchQuery, activeTab]);

  // Handle click outside to close modal and keyboard shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCreateForm) {
          setShowCreateForm(false);
          setCreateForm({
            title: '',
            description: '',
            priority: 'MEDIUM',
            assignedToName: '',
            dueDate: ''
          });
        } else if (editingTask) {
          setEditingTask(null);
          setEditForm({});
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, showCreateForm, editingTask]);

  const fetchTasks = async () => {
    try {
      // Fetch tasks only for the current workspace
      const response = await fetch(`/api/tasks?roomId=${workspaceId}`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Filter by active/archived tab
    if (activeTab === 'active') {
      filtered = filtered.filter(task => task.reviewStatus !== 'reviewed');
    } else {
      filtered = filtered.filter(task => task.reviewStatus === 'reviewed');
    }

    // Filter by review status (only for active tab)
    if (activeTab === 'active' && filterStatus !== 'all') {
      filtered = filtered.filter(task => task.reviewStatus === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.assignedToName?.toLowerCase().includes(query)
      );
    }

    setFilteredTasks(filtered);
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t._id)));
    }
  };

  const handleSelectTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleMarkAsReviewed = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: Array.from(selectedTasks),
          updates: { reviewStatus: 'reviewed' }
        })
      });

      if (response.ok) {
        await fetchTasks();
        setSelectedTasks(new Set());
        // Switch to archived tab to see the reviewed tasks
        setActiveTab('archived');
      }
    } catch (error) {
      console.error('Error marking tasks as reviewed:', error);
    }
  };

  const handleUndoReview = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: Array.from(selectedTasks),
          updates: { 
            reviewStatus: 'pending_review',
            reviewedAt: null,
            reviewedBy: null
          }
        })
      });

      if (response.ok) {
        await fetchTasks();
        setSelectedTasks(new Set());
        // Switch to active tab to see the unreviewed tasks
        setActiveTab('active');
      }
    } catch (error) {
      console.error('Error undoing task review:', error);
    }
  };

  const handleDeleteTasks = async () => {
    if (selectedTasks.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedTasks.size} task(s)?`)) {
      return;
    }

    try {
      for (const taskId of selectedTasks) {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        });
      }
      
      await fetchTasks();
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error deleting tasks:', error);
    }
  };



  const handleEditTask = (task: Task) => {
    setEditingTask(task._id);
    setEditForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assignedToName: task.assignedToName,
      dueDate: task.dueDate
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;

    try {
      const response = await fetch(`/api/tasks/${editingTask}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        await fetchTasks();
        setEditingTask(null);
        setEditForm({});
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!createForm.title.trim()) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: workspaceId,
          title: createForm.title,
          description: createForm.description || undefined,
          priority: createForm.priority,
          assignedToName: createForm.assignedToName || undefined,
          dueDate: createForm.dueDate || undefined,
          isAiGenerated: false
        })
      });

      if (response.ok) {
        await fetchTasks();
        setShowCreateForm(false);
        setCreateForm({
          title: '',
          description: '',
          priority: 'MEDIUM',
          assignedToName: '',
          dueDate: ''
        });
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review': return <AlertCircle size={14} className="text-yellow-600" />;
      case 'reviewed': return <CheckSquare size={14} className="text-green-600" />;
      case 'exported': return <Download size={14} className="text-blue-600" />;
      default: return null;
    }
  };

  const pendingCount = tasks.filter(t => t.reviewStatus === 'pending_review').length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div ref={modalRef} className="bg-card rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Task Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review and manage AI-generated tasks from your meetings
                {pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    {pendingCount} pending review
                  </span>
                )}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {activeTab === 'active' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending_review">Pending Review</option>
              </select>
            )}

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('active')}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'active'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Active ({tasks.filter(t => t.reviewStatus !== 'reviewed').length})
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'archived'
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Archived ({tasks.filter(t => t.reviewStatus === 'reviewed').length})
              </button>
            </div>
            
            {/* Add Task Button - Only show on active tab */}
            {activeTab === 'active' && (
              <Button
                size="sm"
                onClick={() => setShowCreateForm(true)}
                className="gap-2"
              >
                <Plus size={16} />
                Add Task
              </Button>
            )}
          </div>
        </div>

        {/* Action Bar */}
        {selectedTasks.size > 0 && (
          <div className="px-6 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              {activeTab === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAsReviewed}
                >
                  Mark as Reviewed
                </Button>
              )}
              {activeTab === 'archived' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndoReview}
                  className="gap-2"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo Review
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteTasks}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create Task Form */}
          {showCreateForm && (
            <div className="border border-border rounded-lg p-4 mb-4 bg-muted/20">
              <h4 className="font-medium text-foreground mb-3">Create New Task</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                  placeholder="Task title *"
                  autoFocus
                />
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                  placeholder="Description (optional)"
                  rows={2}
                />
                <div className="flex gap-3">
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as 'HIGH' | 'MEDIUM' | 'LOW' })}
                    className="px-3 py-2 bg-background border border-border rounded text-sm"
                  >
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                  <input
                    type="text"
                    value={createForm.assignedToName}
                    onChange={(e) => setCreateForm({ ...createForm, assignedToName: e.target.value })}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm"
                    placeholder="Assigned to (optional)"
                  />
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="px-3 py-2 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleCreateTask}
                    disabled={!createForm.title.trim()}
                  >
                    Create Task
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateForm({
                        title: '',
                        description: '',
                        priority: 'MEDIUM',
                        assignedToName: '',
                        dueDate: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 && !showCreateForm ? (
            <div className="text-center py-12">
              <CheckSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Tasks will appear here after your meetings'}
              </p>
              {activeTab === 'active' && !searchQuery && filterStatus === 'all' && filterPriority === 'all' && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="gap-2"
                >
                  <Plus size={16} />
                  Create Your First Task
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <input
                  type="checkbox"
                  checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>

              {/* Task Items */}
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => handleSelectTask(task._id)}
                  className={cn(
                    "border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                    selectedTasks.has(task._id) && "bg-muted/30 border-primary"
                  )}
                >
                  {editingTask === task._id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                        placeholder="Task title"
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                        placeholder="Description"
                        rows={2}
                      />
                      <div className="flex gap-3">
                        <select
                          value={editForm.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                          className="px-3 py-2 bg-background border border-border rounded text-sm"
                        >
                          <option value="HIGH">High Priority</option>
                          <option value="MEDIUM">Medium Priority</option>
                          <option value="LOW">Low Priority</option>
                        </select>
                        <input
                          type="text"
                          value={editForm.assignedToName || ''}
                          onChange={(e) => setEditForm({ ...editForm, assignedToName: e.target.value })}
                          className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm"
                          placeholder="Assigned to"
                        />
                        <input
                          type="date"
                          value={editForm.dueDate ? format(new Date(editForm.dueDate), 'yyyy-MM-dd') : ''}
                          onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                          className="px-3 py-2 bg-background border border-border rounded text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingTask(null);
                          setEditForm({});
                        }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task._id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectTask(task._id);
                        }}
                        className="mt-1 rounded"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                            )}
                            
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className={cn("px-2 py-0.5 rounded-full font-medium", getPriorityColor(task.priority))}>
                                {task.priority}
                              </span>
                              
                              {task.assignedToName && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <User size={12} />
                                  {task.assignedToName}
                                </span>
                              )}
                              
                              {task.dueDate && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar size={12} />
                                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                                </span>
                              )}
                              
                              {task.meetingTitle && (
                                <span className="text-muted-foreground">
                                  from &ldquo;{task.meetingTitle}&rdquo;
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task.reviewStatus || 'pending_review')}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 