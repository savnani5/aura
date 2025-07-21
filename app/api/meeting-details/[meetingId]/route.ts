import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/meeting-details/[meetingId] - Get detailed meeting information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    
    const db = DatabaseService.getInstance();
    const meeting = await db.getMeetingById(meetingId);
    
    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting not found' 
      }, { status: 404 });
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