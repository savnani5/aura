import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService, CreateTaskData, TaskStatus, TaskPriority } from '@/lib/prisma';

const dbService = DatabaseService.getInstance();

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      meetingId, 
      title, 
      description, 
      priority, 
      dueDate, 
      assigneeId,
      isAiGenerated,
      aiConfidence 
    } = body;

    // Validation
    if (!meetingId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: meetingId, title' },
        { status: 400 }
      );
    }

    const taskData: CreateTaskData = {
      meetingId,
      title,
      description,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeId,
      isAiGenerated: isAiGenerated || false,
      aiConfidence
    };

    const task = await dbService.createTask(taskData);

    return NextResponse.json({
      success: true,
      task
    });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/tasks - Update a task
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      taskId, 
      title, 
      description, 
      status, 
      priority, 
      dueDate, 
      assigneeId 
    } = body;

    // Validation
    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing required field: taskId' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: TODO, IN_PROGRESS, or DONE' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be: HIGH, MEDIUM, or LOW' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status as TaskStatus;
    if (priority !== undefined) updateData.priority = priority as TaskPriority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    const task = await dbService.updateTask(taskId, updateData);

    return NextResponse.json({
      success: true,
      task
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update task',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks - Delete a task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing required parameter: taskId' },
        { status: 400 }
      );
    }

    await dbService.deleteTask(taskId);

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete task',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 