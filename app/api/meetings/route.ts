import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { FastDB, IUser } from '@/lib/mongodb-lite';

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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    
    console.log('📋 Query params:', { type, limit });
    
    // Get user from database to get the MongoDB ObjectId
    let user: IUser | null = await FastDB.getUserByClerkId(userId);
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
        };
        
        user = await FastDB.createUser(userData);
        console.log(`✅ User created successfully:`, { id: user._id, name: user.name, email: user.email });
      } catch (createError) {
        console.error('❌ Failed to create user:', createError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create user account' 
        }, { status: 500 });
      }
    }
    
    if (type === 'instant') {
      console.log('⚡ Fetching instant meetings');
      // Fetch one-off meetings
      const oneOffMeetings = await FastDB.getOneOffMeetings(limit);
      console.log('⚡ Found', oneOffMeetings.length, 'instant meetings');
      
      return NextResponse.json({ 
        success: true, 
        data: oneOffMeetings 
      });
    } else {
      console.log('🏠 Fetching meeting rooms');
      // Default: fetch meeting rooms
      const meetingRooms = await FastDB.getAllRooms();
      console.log('🏠 Found', meetingRooms.length, 'meeting rooms');
      
      return NextResponse.json({ 
        success: true, 
        data: meetingRooms 
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
      participantName // For instant meetings
    } = body;

    // Validate required fields
    if (!roomName || !title || !type) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: roomName, title, type' 
      }, { status: 400 });
    }
    
    // Get user from database
    let user: IUser | null = await FastDB.getUserByClerkId(userId);
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
        };
        
        user = await FastDB.createUser(userData);
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
      const oneOffMeeting = await FastDB.createOneOffMeeting({
        roomName,
        title,
        type,
        startedAt: new Date(),
        participants: [{
          userId: user._id,
          name: user.name,
          isHost: true
        }]
      });
      
      return NextResponse.json({ 
        success: true, 
        data: oneOffMeeting 
      }, { status: 201 });
    } else {
      // Create meeting room with user as creator and host
      const roomData = {
        roomName,
        title,
        type,
        isRecurring: true,
        participants: [{
          userId: user._id,
          email: user.email || '',
          name: user.name,
          role: 'host' as const
        }],
        createdBy: user._id,
        isActive: false
      };

      const createdRoom = await FastDB.createRoom(roomData);
      
      return NextResponse.json({ 
        success: true, 
        data: createdRoom 
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating meeting/room:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create meeting or room' 
    }, { status: 500 });
  }
} 