'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './TaskBoard.module.css';

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
  comments?: string[];
}

interface TaskBoardProps {
  roomName: string;
}

export function TaskBoard({ roomName }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  
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
      try {
        // Mock data for now - replace with actual API calls
        const mockTasks: Task[] = [
          {
            id: '1',
            title: 'Review quarterly reports',
            description: 'Go through the Q3 financial reports and prepare feedback',
            status: 'PENDING',
            priority: 'HIGH',
            assigneeId: '1',
            assigneeName: 'Alice Johnson',
            dueDate: '2024-02-15',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isAiGenerated: false,
            comments: ['Initial task created', 'Need to focus on revenue analysis']
          },
          {
            id: '2',
            title: 'Update API documentation',
            description: 'Add new endpoint documentation for v2 API',
            status: 'PENDING',
            priority: 'MEDIUM',
            assigneeId: '2',
            assigneeName: 'Bob Smith',
            dueDate: '2024-02-20',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isAiGenerated: true,
            comments: []
          },
          {
            id: '3',
            title: 'Design review for new features',
            description: 'Review UI/UX designs for the upcoming features',
            status: 'COMPLETED',
            priority: 'LOW',
            assigneeId: '3',
            assigneeName: 'Carol Davis',
            dueDate: '2024-02-10',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isAiGenerated: false,
            comments: ['Design looks good', 'Approved for development']
          }
        ];

        const mockParticipants = [
          { id: '1', name: 'Alice Johnson' },
          { id: '2', name: 'Bob Smith' },
          { id: '3', name: 'Carol Davis' },
          { id: '4', name: 'David Wilson' }
        ];

        setTasks(mockTasks);
        setParticipants(mockParticipants);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomName]);

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
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title.trim(),
      status: 'PENDING',
      priority: newTask.priority,
      assigneeName: newTask.assigneeName.trim() || undefined,
      dueDate: newTask.dueDate || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAiGenerated: false,
      comments: []
    };

    try {
      // TODO: Replace with actual API call
      console.log('Creating task:', task);
      setTasks(prev => [task, ...prev]);
      setIsAddingTask(false);
    } catch (error) {
      console.error('Error creating task:', error);
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
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: task.status === 'PENDING' ? 'COMPLETED' : 'PENDING' }
        : task
    ));
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
    ));
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setShowTaskModal(false);
    setSelectedTask(null);
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading tasks...</p>
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
        {tasks.map(task => (
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Additional actions menu could go here
                }}
                className={styles.moreButton}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="1" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="5" r="1" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="19" r="1" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {tasks.length === 0 && !isAddingTask && (
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
    onUpdate(task.id, editedTask);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const updatedComments = [...(editedTask.comments || []), newComment.trim()];
    setEditedTask(prev => ({ ...prev, comments: updatedComments }));
    setNewComment('');
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
                  <div className={styles.commentText}>{comment}</div>
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