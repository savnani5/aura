import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService, fromCreateMeetingForm, toMeetingRoomCard, toOneOffMeeting } from '@/lib/mongodb';

// GET /api/meetings - Get meeting rooms or one-off meetings based on query params
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
    const type = searchParams.get('type'); // 'instant' for one-off meetings
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    
    console.log('📋 Query params:', { type, limit });
    
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
    
    if (type === 'instant') {
      console.log('⚡ Fetching instant meetings for user:', user._id);
      // Fetch user's one-off meetings
      const oneOffMeetings = await db.getOneOffMeetingsByUser(user._id, limit);
      console.log('⚡ Raw instant meetings from DB:', oneOffMeetings.length, 'meetings');
      
      const formattedMeetings = oneOffMeetings.map(meeting => toOneOffMeeting(meeting));
      console.log('⚡ Formatted instant meetings:', formattedMeetings);
      
      return NextResponse.json({ 
        success: true, 
        data: formattedMeetings 
      });
    } else {
      console.log('🏠 Fetching meeting rooms for user:', user._id);
      // Default: fetch user's meeting rooms
      const meetingRooms = await db.getMeetingRoomsByUser(user._id, user.email, limit);
      console.log('🏠 Raw meeting rooms from DB:', meetingRooms.length, 'rooms');
      console.log('🏠 Meeting rooms details:', meetingRooms.map(room => ({
        id: room._id,
        roomName: room.roomName,
        title: room.title,
        createdBy: room.createdBy,
        participants: room.participants.map(p => ({ name: p.name, role: p.role, userId: p.userId, email: p.email }))
      })));
      
      const formattedRooms = meetingRooms.map(room => toMeetingRoomCard(room));
      console.log('🏠 Formatted meeting rooms:', formattedRooms);
      
      return NextResponse.json({ 
        success: true, 
        data: formattedRooms 
      });
    }
  } catch (error) {
    console.error('❌ Error fetching meetings:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch meetings' 
    }, { status: 500 });
  }
}

// POST /api/meetings - Create a new meeting room OR one-off meeting
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
      participantName // For instant meetings
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
    
    if (isRecurring === false) {
      // Create one-off meeting with user as participant
      const oneOffMeeting = await db.createOneOffMeeting({
        roomName,
        title,
        type,
        participantName: user.name,
        userId: user._id
      });
      
      return NextResponse.json({ 
        success: true, 
        data: toOneOffMeeting(oneOffMeeting) 
      }, { status: 201 });
    } else {
      // Create meeting room (existing logic)
      
      // Check if room already exists
      const existingRoom = await db.getMeetingRoomByName(roomName);
      if (existingRoom) {
        return NextResponse.json({ 
          success: false, 
          error: 'Meeting room with this name already exists' 
        }, { status: 409 });
      }

      // Create meeting room with user as creator and host
      const roomData = fromCreateMeetingForm({
        roomName,
        title,
        type,
        isRecurring: isRecurring || false,
        participants: participants || [],
        startDate,
        endDate,
        frequency,
        recurringDay,
        recurringTime
      }, user._id);

      const createdRoom = await db.createMeetingRoom(roomData);
      
      return NextResponse.json({ 
        success: true, 
        data: toMeetingRoomCard(createdRoom) 
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create meeting' 
    }, { status: 500 });
  }
} 