import { NextRequest, NextResponse } from 'next/server';

// Mock meeting room data
const mockMeetingRooms: Record<string, any> = {
  'weekly-standup-123': {
    id: 'weekly-standup-123',
    roomName: 'weekly-standup-123',
    title: 'Weekly Team Standup',
    type: 'Daily Standup',
    description: 'Our regular team sync to discuss progress and blockers',
    isRecurring: true,
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    participantCount: 5,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    recentMeetings: 12
  },
  'client-review-456': {
    id: 'client-review-456',
    roomName: 'client-review-456',
    title: 'Client Project Review',
    type: 'Client Review',
    description: 'Monthly review with the client team',
    isRecurring: true,
    createdAt: '2024-01-05T14:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
    participantCount: 8,
    lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isActive: true,
    recentMeetings: 3
  },
  'design-sync-789': {
    id: 'design-sync-789',
    roomName: 'design-sync-789',
    title: 'Design Team Sync',
    type: 'Design Review',
    description: 'Weekly design review and feedback session',
    isRecurring: true,
    createdAt: '2024-01-10T16:00:00Z',
    updatedAt: '2024-01-14T16:00:00Z',
    participantCount: 4,
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    recentMeetings: 8
  },
  'sprint-planning-101': {
    id: 'sprint-planning-101',
    roomName: 'sprint-planning-101',
    title: 'Sprint Planning',
    type: 'Project Planning',
    description: 'Bi-weekly sprint planning and estimation',
    isRecurring: true,
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-08T12:00:00Z',
    participantCount: 6,
    lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    recentMeetings: 6
  },
  'engineering-sync-202': {
    id: 'engineering-sync-202',
    roomName: 'engineering-sync-202',
    title: 'Engineering Team Sync',
    type: 'Team Sync',
    description: 'Weekly engineering team synchronization meeting',
    isRecurring: true,
    createdAt: '2024-01-03T11:00:00Z',
    updatedAt: '2024-01-12T11:30:00Z',
    participantCount: 12,
    lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    recentMeetings: 15
  },
  'product-review-303': {
    id: 'product-review-303',
    roomName: 'product-review-303',
    title: 'Product Review Meeting',
    type: 'Product Review',
    description: 'Monthly product roadmap and feature review',
    isRecurring: true,
    createdAt: '2024-01-01T15:00:00Z',
    updatedAt: '2024-01-10T15:30:00Z',
    participantCount: 7,
    lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    recentMeetings: 4
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    
    // Remove artificial delay - real APIs are fast with proper indexing
    // await new Promise(resolve => setTimeout(resolve, 200));
    
    const room = mockMeetingRooms[roomName];
    
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 