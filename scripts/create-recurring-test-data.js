const { DatabaseService } = require('../lib/mongodb');

async function createRecurringTestData() {
  try {
    const db = DatabaseService.getInstance();
    await db.ensureConnection();
    
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
        endDate: new Date('2025-03-01') // Ends in March
      },
      participants: [
        { name: 'Alice Johnson', role: 'host', joinedAt: new Date() },
        { name: 'Bob Smith', role: 'member', joinedAt: new Date() },
        { name: 'Carol Davis', role: 'member', joinedAt: new Date() },
        { name: 'David Wilson', role: 'member', joinedAt: new Date() }
      ],
      createdBy: null,
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
        endDate: new Date('2025-06-01')
      },
      participants: [
        { name: 'Emma Thompson', role: 'host', joinedAt: new Date() },
        { name: 'Frank Miller', role: 'member', joinedAt: new Date() },
        { name: 'Grace Lee', role: 'member', joinedAt: new Date() },
        { name: 'Henry Brown', role: 'member', joinedAt: new Date() },
        { name: 'Ivy Chen', role: 'member', joinedAt: new Date() }
      ],
      createdBy: null,
      isActive: false,
      meetings: [],
      tasks: []
    });
    
    console.log('✅ Created project planning room:', projectRoom.roomName);
    
    // Generate historical meetings for project room
    const projectMeetings = await db.generateRecurringMeetingHistory(projectRoom._id, 6);
    
    console.log(`✅ Generated ${projectMeetings.length} project planning meetings`);
    
    console.log('\n📋 Summary:');
    console.log(`- Created 2 recurring meeting rooms`);
    console.log(`- Generated ${meetings.length + projectMeetings.length} total historical meetings`);
    console.log('\nRecurring rooms created:');
    console.log(`1. ${recurringRoom.roomName} - ${recurringRoom.title} (Weekly, Mondays 9:00 AM)`);
    console.log(`2. ${projectRoom.roomName} - ${projectRoom.title} (Biweekly, Fridays 2:00 PM)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
}

createRecurringTestData(); 