import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// GET /api/tasks/[taskId] - Get a specific task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    const db = DatabaseService.getInstance();
    
    const task = await db.getTaskById(taskId);
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: task 
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch task' 
    }, { status: 500 });
  }
}

// PATCH /api/tasks/[taskId] - Update a specific task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    const db = DatabaseService.getInstance();
    
    // Convert dueDate string to Date if provided
    if (body.dueDate) {
      body.dueDate = new Date(body.dueDate);
    }
    
    // Handle null dueDate
    if (body.dueDate === null) {
      body.dueDate = null;
    }
    
    // Set completedAt if status is being changed to DONE
    if (body.status === 'DONE' && !body.completedAt) {
      body.completedAt = new Date();
    }
    
    // Clear completedAt if status is being changed away from DONE
    if (body.status && body.status !== 'DONE') {
      body.completedAt = null;
    }

    const updatedTask = await db.updateTask(taskId, body);
    
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

// DELETE /api/tasks/[taskId] - Delete a specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    const db = DatabaseService.getInstance();
    
    // Check if task exists first
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Delete the task
    const deletedTask = await db.deleteTask(taskId);
    
    return NextResponse.json({ 
      success: true, 
      data: deletedTask 
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete task' 
    }, { status: 500 });
  }
} 