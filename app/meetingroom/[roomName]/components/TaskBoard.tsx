'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { Ban, Clock, User, Calendar, Plus, Trash2, Edit2, Save, X, MessageSquare, Send, Filter } from 'lucide-react';
import styles from '@/styles/TaskBoard.module.css';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'COMPLETED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  isAiGenerated: boolean;
  comments?: Array<{
    userId?: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
}

interface TaskBoardProps {
  roomName: string;
}

interface FilterState {
  status: 'all' | 'pending' | 'completed';
  priority: 'all' | 'HIGH' | 'MEDIUM' | 'LOW';
  sortBy: 'priority' | 'dueDate' | 'created';
  sortOrder: 'asc' | 'desc';
}

export function TaskBoard({ roomName }: TaskBoardProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    priority: 'all',
    sortBy: 'priority',
    sortOrder: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    assigneeName: '',
    priority: 'MEDIUM' as Task['priority'],
    dueDate: ''
  });

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Fetch tasks and participants
  useEffect(() => {
    const fetchData = async () => {
      // Check if user is authenticated before making API calls
      if (!userLoaded) return; // Wait for user to load
      
      if (!user) {
        // Guest user - don't fetch dashboard data
        console.log('Guest user detected - TaskBoard not available for guests');
        setTasks([]);
        setParticipants([]);
        setLoading(false);
        return;
      }
      
      try {
        // Fetch room data first to get room ID
        const roomResponse = await fetch(`/api/meetings/${roomName}`);
        if (!roomResponse.ok) {
          throw new Error('Failed to fetch room data');
        }
        const roomData = await roomResponse.json();
        
        if (!roomData.success) {
          throw new Error(roomData.error);
        }
        
        const room = roomData.data;
        setRoomId(room._id);
        
        // Fetch tasks for this room
        const tasksResponse = await fetch(`/api/tasks?roomId=${room._id}`);
        if (!tasksResponse.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const tasksData = await tasksResponse.json();
        
        // Transform tasks to match our interface
        const transformedTasks: Task[] = tasksData.success ? tasksData.data.map((task: any) => ({
          id: task._id,
          title: task.title,
          description: task.description,
          status: task.status === 'TODO' ? 'PENDING' : task.status === 'DONE' ? 'COMPLETED' : 'PENDING',
          priority: task.priority,
          assigneeId: task.assignedTo || task.assignedToName?.toLowerCase().replace(/\s+/g, '-'),
          assigneeName: task.assignedToName,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          isAiGenerated: task.isAiGenerated,
          comments: task.comments || []
        })) : [];
        
        // Get participants from room data
        const transformedParticipants = room.participants.map((participant: any, index: number) => ({
          id: participant.userId || `${participant.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name: participant.name
        }));

        setTasks(transformedTasks);
        setParticipants(transformedParticipants);
      } catch (error) {
        console.error('Error fetching data:', error);
        setTasks([]);
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomName, user, userLoaded]);

  // Focus on title input when adding new task
  useEffect(() => {
    if (isAddingTask && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isAddingTask]);

  const handleAddTask = () => {
    setIsAddingTask(true);
    setNewTask({
      title: '',
      assigneeName: '',
      priority: 'MEDIUM',
      dueDate: ''
    });
  };

  const handleSaveNewTask = async () => {
    if (!newTask.title.trim() || !roomId) return;

    try {
      // Create task in database
      const taskData = {
        title: newTask.title.trim(),
        description: '',
        status: 'TODO', // Use database format
        priority: newTask.priority,
        assignedToName: newTask.assigneeName.trim() || undefined,
        dueDate: newTask.dueDate || undefined,
        roomId: roomId,
        isAiGenerated: false
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const result = await response.json();
      
      if (result.success) {
        // Transform the created task to match our interface
        const createdTask: Task = {
          id: result.data._id,
          title: result.data.title,
          description: result.data.description,
          status: result.data.status === 'TODO' ? 'PENDING' : result.data.status === 'DONE' ? 'COMPLETED' : 'PENDING',
          priority: result.data.priority,
          assigneeId: result.data.assignedTo || result.data.assignedToName?.toLowerCase().replace(/\s+/g, '-'),
          assigneeName: result.data.assignedToName,
          dueDate: result.data.dueDate ? new Date(result.data.dueDate).toISOString().split('T')[0] : '',
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
          isAiGenerated: result.data.isAiGenerated,
          comments: result.data.comments || []
        };

        // Add to local state
        setTasks(prev => [createdTask, ...prev]);
        setIsAddingTask(false);
        
        // Reset form
        setNewTask({
          title: '',
          assigneeName: '',
          priority: 'MEDIUM',
          dueDate: ''
        });
      } else {
        throw new Error(result.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    }
  };

  const handleCancelNewTask = () => {
    setIsAddingTask(false);
    setNewTask({
      title: '',
      assigneeName: '',
      priority: 'MEDIUM',
      dueDate: ''
    });
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    const taskToUpdate = tasks.find(task => task.id === taskId);
    if (!taskToUpdate) return;

    const newStatus = taskToUpdate.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
    const dbStatus = newStatus === 'PENDING' ? 'TODO' : 'DONE';

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: dbStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
          : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  const handleTaskClick = async (task: Task) => {
    try {
      // Fetch fresh task data to ensure we have the latest comments
      const response = await fetch(`/api/tasks/${task.id}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Transform the fresh task data to match our interface
          const freshTask: Task = {
            id: result.data._id,
            title: result.data.title,
            description: result.data.description,
            status: result.data.status === 'TODO' ? 'PENDING' : result.data.status === 'DONE' ? 'COMPLETED' : 'PENDING',
            priority: result.data.priority,
            assigneeId: result.data.assignedTo || result.data.assignedToName?.toLowerCase().replace(/\s+/g, '-'),
            assigneeName: result.data.assignedToName,
            dueDate: result.data.dueDate ? new Date(result.data.dueDate).toISOString().split('T')[0] : '',
            createdAt: result.data.createdAt,
            updatedAt: result.data.updatedAt,
            isAiGenerated: result.data.isAiGenerated,
            comments: result.data.comments || []
          };
          setSelectedTask(freshTask);
        } else {
          // Fallback to existing task data if fetch fails
          setSelectedTask(task);
        }
      } else {
        // Fallback to existing task data if fetch fails
        setSelectedTask(task);
      }
    } catch (error) {
      console.error('Error fetching fresh task data:', error);
      // Fallback to existing task data if fetch fails
      setSelectedTask(task);
    }
    setShowTaskModal(true);
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Transform updates to database format
      const dbUpdates: any = { ...updates };
      if (updates.status) {
        dbUpdates.status = updates.status === 'PENDING' ? 'TODO' : 'DONE';
      }
      if (updates.dueDate === '') {
        dbUpdates.dueDate = null;
      }
      
      // Remove comments from the main update - we'll handle them separately
      delete dbUpdates.comments;

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dbUpdates),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
      ));
      setShowTaskModal(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Remove from local state
      setTasks(prev => prev.filter(task => task.id !== taskId));
      setShowTaskModal(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const formatDueDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  // Filter and sort tasks
  const getFilteredAndSortedTasks = () => {
    let filteredTasks = [...tasks];

    // Apply status filter
    if (filters.status !== 'all') {
      filteredTasks = filteredTasks.filter(task => {
        if (filters.status === 'pending') return task.status === 'PENDING';
        if (filters.status === 'completed') return task.status === 'COMPLETED';
        return true;
      });
    }

    // Apply priority filter
    if (filters.priority !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
    }

    // Apply sorting
    filteredTasks.sort((a, b) => {
      let comparison = 0;

      if (filters.sortBy === 'priority') {
        const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (filters.sortBy === 'dueDate') {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        
        // Handle tasks without due dates (put them at the end)
        if (!a.dueDate && !b.dueDate) comparison = 0;
        else if (!a.dueDate) comparison = 1;
        else if (!b.dueDate) comparison = -1;
        else comparison = aDate - bDate;
      } else if (filters.sortBy === 'created') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredTasks;
  };

  const filteredTasks = getFilteredAndSortedTasks();

  // If user is not loaded yet, show loading
  if (!userLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated (guest), show message
  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.guestMessage}>
          <Ban size={48} />
          <h3>Task Management Not Available</h3>
          <p>Task management is only available to authenticated meeting participants. Please sign in to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Tasks</h2>
          <p className={styles.subtitle}>Track and manage team assignments</p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${styles.filterButton} ${showFilters ? styles.active : ''}`}
          >
            <Filter size={16} />
            Filter & Sort
          </button>
          <button
            onClick={handleAddTask}
            disabled={isAddingTask}
            className={styles.addButton}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterState['status'] }))}
                className={styles.filterSelect}
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as FilterState['priority'] }))}
                className={styles.filterSelect}
              >
                <option value="all">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as FilterState['sortBy'] }))}
                className={styles.filterSelect}
              >
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="created">Created Date</option>
              </select>
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value as FilterState['sortOrder'] }))}
                className={styles.filterSelect}
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
            
            <button
              onClick={() => setFilters({
                status: 'all',
                priority: 'all',
                sortBy: 'priority',
                sortOrder: 'desc'
              })}
              className={styles.resetButton}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className={styles.taskList}>
        {/* Table Header */}
        <div className={styles.tableHeader}>
          <div className={styles.checkboxColumn}></div>
          <div className={styles.taskColumn}>Task</div>
          <div className={styles.ownerColumn}>Owner</div>
          <div className={styles.priorityColumn}>Priority</div>
          <div className={styles.dueDateColumn}>Due Date</div>
          <div className={styles.actionsColumn}></div>
        </div>

        {/* New Task Row */}
        {isAddingTask && (
          <div className={styles.taskRow}>
            <div className={styles.checkboxColumn}>
              <div className={styles.checkbox} />
            </div>
            <div className={styles.taskColumn}>
              <input
                ref={titleInputRef}
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title..."
                className={styles.taskInput}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNewTask();
                  } else if (e.key === 'Escape') {
                    handleCancelNewTask();
                  }
                }}
              />
            </div>
            <div className={styles.ownerColumn}>
              <input
                type="text"
                value={newTask.assigneeName}
                onChange={(e) => setNewTask(prev => ({ ...prev, assigneeName: e.target.value }))}
                placeholder="Assignee"
                className={styles.ownerInput}
                list="participants"
              />
              <datalist id="participants">
                {participants.map(participant => (
                  <option key={participant.id} value={participant.name} />
                ))}
              </datalist>
            </div>
            <div className={styles.priorityColumn}>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                className={styles.prioritySelect}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className={styles.dueDateColumn}>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.actionsColumn}>
              <button onClick={handleSaveNewTask} className={styles.saveButton}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              <button onClick={handleCancelNewTask} className={styles.cancelButton}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Existing Tasks */}
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`${styles.taskRow} ${task.status === 'COMPLETED' ? styles.completedTask : ''}`}
            onClick={() => handleTaskClick(task)}
          >
            <div className={styles.checkboxColumn}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTaskStatus(task.id);
                }}
                className={`${styles.checkbox} ${task.status === 'COMPLETED' ? styles.checked : ''}`}
              >
                {task.status === 'COMPLETED' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>
            <div className={styles.taskColumn}>
              <span className={styles.taskTitle}>{task.title}</span>
              {task.isAiGenerated && (
                <span className={styles.aiTag}>AI</span>
              )}
            </div>
            <div className={styles.ownerColumn}>
              {task.assigneeName && (
                <div className={styles.assignee}>
                  <div className={styles.assigneeAvatar}>
                    {task.assigneeName.charAt(0).toUpperCase()}
                  </div>
                  <span>{task.assigneeName}</span>
                </div>
              )}
            </div>
            <div className={styles.priorityColumn}>
              <span 
                className={styles.priorityBadge}
                style={{ backgroundColor: getPriorityColor(task.priority) }}
              >
                {task.priority}
              </span>
            </div>
            <div className={styles.dueDateColumn}>
              {task.dueDate && (
                <span className={`${styles.dueDate} ${isOverdue(task.dueDate) ? styles.overdue : ''}`}>
                  {formatDueDate(task.dueDate)}
                </span>
              )}
            </div>
            <div className={styles.actionsColumn}>
              {/* Removed non-functional three dots button */}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredTasks.length === 0 && !isAddingTask && (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 11H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2M9 11V9a2 2 0 1 1 4 0v2M9 11h6" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <h3>No tasks yet</h3>
            <p>Add your first task to get started with team collaboration.</p>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          participants={participants}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}

// Task Detail Modal Component
interface TaskDetailModalProps {
  task: Task;
  participants: Array<{ id: string; name: string }>;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

function TaskDetailModal({ task, participants, onUpdate, onDelete, onClose }: TaskDetailModalProps) {
  const [editedTask, setEditedTask] = useState(task);
  const [newComment, setNewComment] = useState('');

  const handleSave = () => {
    // Create a copy without comments for the main update
    const { comments, ...taskUpdates } = editedTask;
    onUpdate(task.id, taskUpdates);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      // Add comment via separate API call
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newComment.trim(),
          userName: 'Current User' // TODO: Get from auth context
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update the edited task with the new comment
          setEditedTask(prev => ({
            ...prev,
            comments: [...(prev.comments || []), result.data]
          }));
          setNewComment('');
        }
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // Fallback to local state update for now
      const newCommentObj = {
        userId: undefined,
        userName: 'Current User',
        text: newComment.trim(),
        createdAt: new Date().toISOString()
      };
      setEditedTask(prev => ({
        ...prev,
        comments: [...(prev.comments || []), newCommentObj]
      }));
      setNewComment('');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Task Details</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              value={editedTask.description || ''}
              onChange={(e) => setEditedTask(prev => ({ ...prev, description: e.target.value }))}
              className={styles.textarea}
              rows={4}
              placeholder="Add task description..."
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Assignee</label>
              <input
                type="text"
                value={editedTask.assigneeName || ''}
                onChange={(e) => setEditedTask(prev => ({ ...prev, assigneeName: e.target.value }))}
                className={styles.input}
                list="modal-participants"
                placeholder="Assign to..."
              />
              <datalist id="modal-participants">
                {participants.map(participant => (
                  <option key={participant.id} value={participant.name} />
                ))}
              </datalist>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Priority</label>
              <select
                value={editedTask.priority}
                onChange={(e) => setEditedTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                className={styles.select}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Due Date</label>
              <input
                type="date"
                value={editedTask.dueDate || ''}
                onChange={(e) => setEditedTask(prev => ({ ...prev, dueDate: e.target.value }))}
                className={styles.input}
              />
            </div>
          </div>

          {/* Comments Section */}
          <div className={styles.commentsSection}>
            <h4 className={styles.commentsTitle}>Comments</h4>
            
            <div className={styles.commentsList}>
              {editedTask.comments?.map((comment, index) => (
                <div key={index} className={styles.comment}>
                  <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{comment.userName}</span>
                    <span className={styles.commentDate}>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.commentText}>{comment.text}</div>
                </div>
              ))}
            </div>

            <div className={styles.addComment}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className={styles.commentInput}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddComment();
                  }
                }}
              />
              <button onClick={handleAddComment} className={styles.addCommentButton}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button onClick={() => onDelete(task.id)} className={styles.deleteButton}>
            Delete Task
          </button>
          <div className={styles.modalActionsRight}>
            <button onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button onClick={handleSave} className={styles.saveButton}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 