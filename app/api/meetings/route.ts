import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService, fromCreateMeetingForm, toMeetingRoomCard } from '@/lib/database/mongodb';

// GET /api/meetings - Get meeting rooms for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    console.log('🔐 API GET /api/meetings - userId:', userId);
    
    if (!userId) {
      console.log('❌ No userId found, returning unauthorized');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    
    console.log('📋 Query params:', { limit });
    
    const db = DatabaseService.getInstance();
    
    // Get user from database to get the MongoDB ObjectId
    let user = await db.getUserByClerkId(userId);
    console.log('👤 User lookup result:', user ? { id: user._id, name: user.name, email: user.email } : 'null');
    
    if (!user) {
      // Fallback: Create user if they don't exist (webhook might have failed)
      console.log(`⚠️ User not found in database for clerkId: ${userId}, creating user...`);
      
      try {
        // Get user data from Clerk
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        
        // Create user in database
        const userData = {
          clerkId: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous User',
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          avatar: clerkUser.imageUrl || '',
          joinedAt: new Date(),
          lastActive: new Date(),
        };
        
        user = await db.createUser(userData);
        console.log(`✅ User created successfully:`, { id: user._id, name: user.name, email: user.email });
        
        // Link user to any rooms they were invited to before signing up
        if (user.email) {
          await db.linkUserToInvitedRooms(user._id, user.email);
        }
      } catch (createError) {
        console.error('❌ Failed to create user:', createError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create user account' 
        }, { status: 500 });
      }
    } else {
      // For existing users, try to link them to any new invitations
      if (user.email) {
        await db.linkUserToInvitedRooms(user._id, user.email);
      }
    }
    
    // Fetch user's meeting rooms
    const meetingRooms = await db.getMeetingRoomsByUser(user._id, user.email, limit);
    
    // Get real-time meeting counts for all rooms
    const roomIds = meetingRooms.map(room => room._id);
    const meetingCounts = await db.getRealMeetingCountsByRooms(roomIds);
    
    const formattedRooms = meetingRooms.map(room => toMeetingRoomCard(room, meetingCounts[room._id]));
    
    return NextResponse.json({ 
      success: true, 
      data: formattedRooms 
    });
  } catch (error) {
    console.error('❌ Error fetching meetings:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch meetings' 
    }, { status: 500 });
  }
}

// POST /api/meetings - Create a new meeting room
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      roomName, 
      title, 
      type, 
      isRecurring, 
      participants, 
      startDate, 
      endDate, 
      frequency, 
      recurringDay, 
      recurringTime,
      recurringTimezone
    } = body;

    // Validate required fields
    if (!roomName || !title || !type) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomName, title, type' 
      }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    
    // Get user from database
    let user = await db.getUserByClerkId(userId);
    if (!user) {
      // Fallback: Create user if they don't exist (webhook might have failed)
      console.log(`User not found in database for clerkId: ${userId}, creating user...`);
      
      try {
        // Get user data from Clerk
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        
        // Create user in database
        const userData = {
          clerkId: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous User',
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          avatar: clerkUser.imageUrl || '',
          joinedAt: new Date(),
          lastActive: new Date(),
        };
        
        user = await db.createUser(userData);
        console.log(`User created successfully: ${user.name}`);
      } catch (createError) {
        console.error('Failed to create user:', createError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create user account' 
        }, { status: 500 });
      }
    }
    
    // Check if room already exists
    const existingRoom = await db.getMeetingRoomByName(roomName);
    if (existingRoom) {
      return NextResponse.json({ 
        success: false, 
        error: 'Meeting room with this name already exists' 
      }, { status: 409 });
    }

    // Ensure the creator is always added as a host participant
    const allParticipants = participants || [];
    
    // Check if creator is already in participants list
    const creatorInParticipants = allParticipants.some(p => 
      p.email === user.email || p.role === 'host'
    );
    
    // If creator is not in participants, add them as host
    if (!creatorInParticipants) {
      allParticipants.unshift({
        email: user.email,
        name: user.name,
        role: 'host'
      });
    }

    // Create meeting room with user as creator and host
    const roomData = fromCreateMeetingForm({
      roomName,
      title,
      type,
      isRecurring: isRecurring || false,
      participants: allParticipants,
      startDate,
      endDate,
      frequency,
      recurringDay,
      recurringTime,
      recurringTimezone
    }, user._id);

    const createdRoom = await db.createMeetingRoom(roomData);
    
    // Get real-time meeting count for the new room (should be 0 since it's new)
    const meetingCount = await db.getRealMeetingCountByRoom(createdRoom._id);
    
    // Send email invitations if there are participants
    if (createdRoom.participants && createdRoom.participants.length > 1) { // More than just the host
      try {
        console.log('📧 Sending email invitations for room:', roomName);
        
        // Call the email API to send invitations
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'invitation',
            roomName: roomName,
            hostName: user.name || 'Host'
          })
        });
        
        const emailResult = await emailResponse.json();
        
        if (emailResult.success) {
          console.log('✅ Email invitations sent successfully:', emailResult.message);
        } else {
          console.error('❌ Failed to send email invitations:', emailResult.error);
          // Don't fail the room creation if email fails
        }
      } catch (emailError) {
        console.error('❌ Error sending email invitations:', emailError);
        // Don't fail the room creation if email fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: toMeetingRoomCard(createdRoom, meetingCount),
      message: createdRoom.participants && createdRoom.participants.length > 1 ? 
        'Meeting room created and invitations sent!' : 
        'Meeting room created successfully!'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create meeting' 
    }, { status: 500 });
  }
} 