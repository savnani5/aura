import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

export async function POST() {
  try {
    const db = DatabaseService.getInstance();
    
    console.log('Creating recurring meeting room...');
    
    // Create a recurring Daily Standup room
    const recurringRoom = await db.createMeetingRoom({
      roomName: 'daily-standup-recurring',
      title: 'Daily Team Standup - Recurring',
      description: 'Daily standup meeting for the development team',
      type: 'Daily Standup',
      isRecurring: true,
      recurringPattern: {
        frequency: 'weekly',
        day: 'Monday',
        time: '09:00',
        startDate: new Date('2024-11-01'), // Started 6 weeks ago
        endDate: new Date('2025-12-01') // Ends in December 2025
      },
      participants: [
        { 
          name: 'Alice Johnson', 
          email: 'alice.johnson@company.com',
          role: 'host', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Bob Smith', 
          email: 'bob.smith@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Carol Davis', 
          email: 'carol.davis@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'David Wilson', 
          email: 'david.wilson@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        }
      ],
      createdBy: undefined,
      isActive: false,
      meetings: [],
      tasks: []
    });
    
    console.log('✅ Created recurring room:', recurringRoom.roomName);
    
    // Generate 8 weeks of historical meetings
    console.log('Generating historical meetings...');
    const meetings = await db.generateRecurringMeetingHistory(recurringRoom._id, 8);
    
    console.log(`✅ Generated ${meetings.length} historical meetings`);
    
    // Create another recurring room for Project Planning
    const projectRoom = await db.createMeetingRoom({
      roomName: 'project-planning-biweekly',
      title: 'Project Planning - Biweekly',
      description: 'Biweekly project planning and review session',
      type: 'Project Planning',
      isRecurring: true,
      recurringPattern: {
        frequency: 'biweekly',
        day: 'Friday',
        time: '14:00',
        startDate: new Date('2024-10-15'),
        endDate: new Date('2025-12-01')
      },
      participants: [
        { 
          name: 'Emma Thompson', 
          email: 'emma.thompson@company.com',
          role: 'host', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Frank Miller', 
          email: 'frank.miller@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Grace Lee', 
          email: 'grace.lee@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Henry Brown', 
          email: 'henry.brown@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        },
        { 
          name: 'Ivy Chen', 
          email: 'ivy.chen@company.com',
          role: 'member', 
          joinedAt: new Date(),
          invitedAt: new Date(),
          linkedAt: new Date()
        }
      ],
      createdBy: undefined,
      isActive: false,
      meetings: [],
      tasks: []
    });
    
    console.log('✅ Created project planning room:', projectRoom.roomName);
    
    // Generate historical meetings for project room
    const projectMeetings = await db.generateRecurringMeetingHistory(projectRoom._id, 6);
    
    console.log(`✅ Generated ${projectMeetings.length} project planning meetings`);
    
    return NextResponse.json({
      success: true,
      message: 'Test data generated successfully',
      data: {
        roomsCreated: 2,
        meetingsGenerated: meetings.length + projectMeetings.length,
        rooms: [
          {
            roomName: recurringRoom.roomName,
            title: recurringRoom.title,
            pattern: 'Weekly, Mondays 9:00 AM',
            meetingsGenerated: meetings.length
          },
          {
            roomName: projectRoom.roomName,
            title: projectRoom.title,
            pattern: 'Biweekly, Fridays 2:00 PM',
            meetingsGenerated: projectMeetings.length
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error generating test data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 