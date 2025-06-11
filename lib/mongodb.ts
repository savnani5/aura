// Temporary stub for MongoDB service to fix build errors
export interface Meeting {
  id: string;
  title: string;
  type: string;
  participants: Array<{ name: string; id: string }>;
  tasks: Array<{ title: string; status: string; assigneeName?: string }>;
}

export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async getMeeting(roomName: string): Promise<Meeting | null> {
    // Temporary stub - return mock data
    return {
      id: roomName,
      title: `Meeting for ${roomName}`,
      type: 'General Meeting',
      participants: [
        { name: 'Alex Chen', id: '1' },
        { name: 'Sarah Johnson', id: '2' }
      ],
      tasks: []
    };
  }
} 