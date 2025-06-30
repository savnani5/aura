import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/email-service';
import { DatabaseService } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email type is required (invitation, new-participant, or summary)' 
      }, { status: 400 });
    }

    const emailService = EmailService.getInstance();

    if (type === 'new-participant') {
      // Send invitations to newly added participants
      const { room, newParticipants, hostName } = body;
      
      if (!room || !newParticipants || !hostName) {
        return NextResponse.json({ 
          success: false, 
          error: 'Missing required fields: room, newParticipants, hostName' 
        }, { status: 400 });
      }

      const result = await emailService.sendNewParticipantInvitations(room, newParticipants, hostName);
      
      return NextResponse.json({ 
        success: result.success,
        message: result.success ? 
          `Invitations sent to ${result.sentTo.length} new participants` :
          `Failed to send some invitations`,
        sentTo: result.sentTo,
        failedTo: result.failedTo,
        errors: result.errors
      });

    } else if (type === 'invitation') {
      // Send meeting invitations (for room creation)
      const { roomName, hostName } = body;
      
      if (!roomName || !hostName) {
        return NextResponse.json({ 
          success: false, 
          error: 'roomName and hostName are required for invitations' 
        }, { status: 400 });
      }

      const db = DatabaseService.getInstance();
      const room = await db.getMeetingRoomByName(roomName);
      
      if (!room) {
        return NextResponse.json({ 
          success: false, 
          error: 'Meeting room not found' 
        }, { status: 404 });
      }

      if (!room.participants || room.participants.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'No participants found in room' 
        }, { status: 400 });
      }

      const result = await emailService.sendMeetingInvitations(room, hostName);
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? 
          `Invitations sent to ${result.sentTo.length} participants` :
          `Failed to send some invitations`,
        sentTo: result.sentTo,
        failedTo: result.failedTo,
        errors: result.errors
      });

    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid email type. Must be "invitation" or "new-participant"' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in email API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
} 
 
 
 
 
 
 