import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { HybridRAGService } from '@/lib/ai/hybrid-rag';

// GET /api/meeting-details/[meetingId] - Get meeting details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { meetingId } = await params;
    const { searchParams } = new URL(request.url);
    const includeTranscripts = searchParams.get('includeTranscripts') === 'true';
    
    const db = DatabaseService.getInstance();
    const meeting = await db.getMeetingById(meetingId);
    
    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting not found' 
      }, { status: 404 });
    }

    // If transcripts are requested and the meeting has embeddings, fetch them from Pinecone
    if (includeTranscripts && meeting.hasEmbeddings) {
      try {
        const hybridRAG = HybridRAGService.getInstance();
        const transcripts = await hybridRAG.getTranscriptsForMeeting(meetingId);
        
        // Add transcripts to the meeting object
        (meeting as any).transcripts = transcripts;
      } catch (error) {
        console.error('Error fetching transcripts from Pinecone:', error);
        // Don't fail the request if transcripts can't be fetched
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: meeting 
    });
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch meeting details' 
    }, { status: 500 });
  }
}

// DELETE /api/meeting-details/[meetingId] - Delete a meeting
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { meetingId } = await params;
    const db = DatabaseService.getInstance();
    
    // Get the meeting first to check permissions
    const meeting = await db.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting not found' 
      }, { status: 404 });
    }

    // Get the meeting room to check if user is authorized to delete
    const room = await db.getMeetingRoom(meeting.roomId.toString());
    if (!room) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room not found' 
      }, { status: 404 });
    }

    // Check if user is the room creator or a participant with host role
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    const isCreator = room.createdBy?.toString() === user._id.toString();
    const isHost = room.participants.some(p => 
      (p.userId?.toString() === user._id.toString() || p.email === user.email) && p.role === 'host'
    );

    if (!isCreator && !isHost) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only room creators or hosts can delete meetings' 
      }, { status: 403 });
    }

    // Delete the meeting (this also deletes associated embeddings)
    const deleted = await db.deleteMeeting(meetingId);
    
    if (!deleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete meeting' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Meeting deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete meeting' 
    }, { status: 500 });
  }
} 