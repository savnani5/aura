import { PrismaClient, TaskStatus, TaskPriority } from './generated/prisma';

// Global Prisma instance for reuse
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { prisma };

// Types
export type { TaskStatus, TaskPriority } from './generated/prisma';

export interface CreateMeetingData {
  roomName: string;
  title?: string;
  type: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface CreateTaskData {
  meetingId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeId?: string;
  isAiGenerated?: boolean;
  aiConfidence?: number;
}

export interface CreateTranscriptData {
  meetingId: string;
  speaker: string;
  text: string;
  embedding?: string;
}

// Database Service Class
export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Meeting operations
  async createOrGetMeeting(data: CreateMeetingData) {
    // Check if meeting already exists
    const existingMeeting = await prisma.meeting.findUnique({
      where: { roomName: data.roomName },
      include: {
        participants: true,
        tasks: {
          include: { assignee: true },
          orderBy: { createdAt: 'desc' }
        },
        summaries: { orderBy: { generatedAt: 'desc' } }
      }
    });

    if (existingMeeting) {
      return existingMeeting;
    }

    // Create new meeting
    return await prisma.meeting.create({
      data: {
        roomName: data.roomName,
        title: data.title,
        type: data.type,
        isRecurring: data.isRecurring || false,
        recurringPattern: data.recurringPattern,
      },
      include: {
        participants: true,
        tasks: { include: { assignee: true } },
        summaries: true
      }
    });
  }

  async getMeeting(roomName: string) {
    return await prisma.meeting.findUnique({
      where: { roomName },
      include: {
        participants: true,
        tasks: {
          include: { assignee: true },
          orderBy: { createdAt: 'desc' }
        },
        transcripts: {
          orderBy: { timestamp: 'desc' },
          take: 100 // Last 100 transcripts
        },
        summaries: { orderBy: { generatedAt: 'desc' } }
      }
    });
  }

  async startMeeting(roomName: string) {
    return await prisma.meeting.update({
      where: { roomName },
      data: { startedAt: new Date() }
    });
  }

  async endMeeting(roomName: string) {
    return await prisma.meeting.update({
      where: { roomName },
      data: { endedAt: new Date() }
    });
  }

  async getAllMeetings() {
    return await prisma.meeting.findMany({
      include: {
        participants: true,
        _count: {
          select: {
            transcripts: true,
            tasks: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  // Participant operations
  async addParticipant(meetingId: string, participantName: string, isHost = false) {
    return await prisma.meetingParticipant.upsert({
      where: {
        meetingId_participantName: {
          meetingId,
          participantName
        }
      },
      update: {
        leftAt: null // Mark as rejoined if they left
      },
      create: {
        meetingId,
        participantName,
        isHost
      }
    });
  }

  async removeParticipant(meetingId: string, participantName: string) {
    return await prisma.meetingParticipant.update({
      where: {
        meetingId_participantName: {
          meetingId,
          participantName
        }
      },
      data: { leftAt: new Date() }
    });
  }

  // Task operations
  async createTask(data: CreateTaskData) {
    return await prisma.task.create({
      data,
      include: { assignee: true }
    });
  }

  async updateTask(taskId: string, data: Partial<CreateTaskData & { status?: TaskStatus }>) {
    return await prisma.task.update({
      where: { id: taskId },
      data: {
        ...data,
        completedAt: data.status === 'DONE' ? new Date() : undefined
      },
      include: { assignee: true }
    });
  }

  async deleteTask(taskId: string) {
    return await prisma.task.delete({
      where: { id: taskId }
    });
  }

  async getTasksForMeeting(meetingId: string) {
    return await prisma.task.findMany({
      where: { meetingId },
      include: { assignee: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Transcript operations
  async createTranscript(data: CreateTranscriptData) {
    return await prisma.transcript.create({
      data
    });
  }

  async getTranscriptsForMeeting(meetingId: string, limit = 100) {
    return await prisma.transcript.findMany({
      where: { meetingId },
      orderBy: { timestamp: 'asc' },
      take: limit
    });
  }

  async searchTranscripts(query: string, meetingId?: string) {
    const whereClause = meetingId 
      ? { 
          meetingId,
          text: { contains: query, mode: 'insensitive' as const }
        }
      : { 
          text: { contains: query, mode: 'insensitive' as const }
        };

    return await prisma.transcript.findMany({
      where: whereClause,
      include: { meeting: true },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
  }

  // Summary operations
  async createMeetingSummary(
    meetingId: string, 
    summary: string, 
    keyPoints: string[] = [],
    actionItems: string[] = [],
    decisions: string[] = [],
    aiModel?: string
  ) {
    return await prisma.meetingSummary.create({
      data: {
        meetingId,
        summary,
        keyPoints,
        actionItems,
        decisions,
        aiModel
      }
    });
  }

  async getLatestSummary(meetingId: string) {
    return await prisma.meetingSummary.findFirst({
      where: { meetingId },
      orderBy: { generatedAt: 'desc' }
    });
  }

  // Cleanup operations
  async cleanupOldData(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete old one-time meetings that have ended
    const result = await prisma.meeting.deleteMany({
      where: {
        type: 'ONETIME',
        endedAt: { lt: cutoffDate },
        isRecurring: false
      }
    });

    return result.count;
  }
} 