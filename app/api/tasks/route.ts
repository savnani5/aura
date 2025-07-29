import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/tasks?roomId=xxx - Get tasks for a specific room
// GET /api/tasks?all=true - Get all tasks for the user across workspaces
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const all = searchParams.get('all');
    const reviewStatus = searchParams.get('reviewStatus') as 'pending_review' | 'reviewed' | 'exported' | null;
    const status = searchParams.get('status') as 'TODO' | 'IN_PROGRESS' | 'DONE' | null;
    const priority = searchParams.get('priority') as 'HIGH' | 'MEDIUM' | 'LOW' | null;
    const limit = searchParams.get('limit');
    const skip = searchParams.get('skip');

    const db = DatabaseService.getInstance();
    
    if (all === 'true') {
      // Get all tasks for the user across workspaces
      const tasks = await db.getTasksByUser(userId, {
        reviewStatus: reviewStatus || undefined,
        status: status || undefined,
        priority: priority || undefined,
        limit: limit ? parseInt(limit) : undefined,
        skip: skip ? parseInt(skip) : undefined
      });
      
      return NextResponse.json({ 
        success: true, 
        data: tasks 
      });
    } else if (roomId) {
      // Get tasks for a specific room
    const tasks = await db.getTasksByRoom(roomId);
    
    return NextResponse.json({ 
      success: true, 
      data: tasks 
    });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Either roomId or all=true parameter is required' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch tasks' 
    }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { 
      roomId, 
      meetingId, 
      title, 
      description, 
      priority, 
      assignedToName,
      createdByName,
      dueDate,
      isAiGenerated,
      aiConfidence
    } = body;

    // Validate required fields
    if (!roomId || !title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomId, title' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    const taskData = {
      roomId,
      meetingId,
      title,
      description,
      priority: priority || 'MEDIUM',
      assignedToName,
      createdByName,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      isAiGenerated: isAiGenerated || false,
      aiConfidence
    };

    const createdTask = await db.createTask(taskData);
    
    return NextResponse.json({ 
      success: true, 
      data: createdTask 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create task' 
    }, { status: 500 });
  }
}

// PATCH /api/tasks - Bulk update tasks
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { taskIds, updates } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'taskIds array is required' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    // If marking as reviewed, add metadata
    if (updates.reviewStatus === 'reviewed') {
      updates.reviewedAt = new Date();
      
      // Convert Clerk ID to MongoDB ObjectId
      const user = await db.getUserByClerkId(userId);
      if (user) {
        updates.reviewedBy = user._id;
      }
    }
    
    // If marking as exported, add metadata
    if (updates.reviewStatus === 'exported' && updates.exportedTo) {
      updates.exportedAt = new Date();
    }
    
    const modifiedCount = await db.bulkUpdateTasks(taskIds, updates);
    
    return NextResponse.json({ 
      success: true, 
      data: { modifiedCount } 
    });
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to bulk update tasks' 
    }, { status: 500 });
  }
}

// PUT /api/tasks - Update a task
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { taskId, ...updates } = body;

    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: 'taskId is required' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    // Convert dueDate string to Date if provided
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }
    
    // Set completedAt if status is being changed to DONE
    if (updates.status === 'DONE' && !updates.completedAt) {
      updates.completedAt = new Date();
    }
    
    // Clear completedAt if status is being changed away from DONE
    if (updates.status && updates.status !== 'DONE') {
      updates.completedAt = null;
    }

    const updatedTask = await db.updateTask(taskId, updates);
    
    if (!updatedTask) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: updatedTask 
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update task' 
    }, { status: 500 });
  }
} 