import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// POST /api/tasks/[taskId]/comments - Add a comment to a specific task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { text, userName, userId } = body;

    if (!text || !userName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: text, userName' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    // Check if task exists
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      return NextResponse.json({ 
        success: false, 
        error: 'Task not found' 
      }, { status: 404 });
    }

    // Create comment object
    const newComment = {
      userId,
      userName,
      text,
      createdAt: new Date()
    };

    // Add comment to task
    const updatedTask = await db.addCommentToTask(taskId, newComment);
    
    if (!updatedTask) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to add comment' 
      }, { status: 500 });
    }
    
    // Return the new comment
    const addedComment = updatedTask.comments[updatedTask.comments.length - 1];
    
    return NextResponse.json({ 
      success: true, 
      data: addedComment 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add comment' 
    }, { status: 500 });
  }
} 