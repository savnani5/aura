import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Global mongoose cache for Next.js
declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// ============= SCHEMAS & MODELS =============

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String }, // Optional for now
  avatar: { type: String },
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Meeting Room Schema (Main dashboard entity)
const MeetingRoomSchema = new mongoose.Schema({
  roomName: { type: String, required: true, unique: true }, // URL slug
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true }, // "Daily Standup", "Client Review", etc.
  
  // Room settings
  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    frequency: { type: String }, // "weekly", "biweekly", "monthly"
    day: { type: String }, // "Monday", "Tuesday", etc.
    time: { type: String }, // "09:00", "14:30", etc.
    startDate: { type: Date },
    endDate: { type: Date }
  },
  
  // Participants
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true }, // Store name directly for easier access
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    notes: { type: String } // Individual participant notes
  }],
  
  // Related data (populated)
  meetings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMeetingAt: { type: Date },
  isActive: { type: Boolean, default: false } // Currently has live meeting
}, {
  timestamps: true
});

// Meeting Schema (Individual meeting sessions)
const MeetingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom' }, // Optional for one-off meetings
  
  // Meeting details
  roomName: { type: String, required: true }, // Unique identifier for the meeting (for LiveKit room)
  title: { type: String }, // Override room title if needed
  type: { type: String, default: 'Meeting' }, // 'Instant Meeting', 'Daily Standup', etc.
  isOneOff: { type: Boolean, default: false }, // True for instant meetings
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  duration: { type: Number }, // in minutes
  
  // Participants in this specific meeting
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    isHost: { type: Boolean, default: false }
  }],
  
  // Transcripts with embeddings for RAG
  transcripts: [{
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    embedding: [{ type: Number }] // Vector embeddings as simple array
  }],
  
  // AI-generated content
  summary: {
    content: { type: String },
    keyPoints: [{ type: String }],
    actionItems: [{ type: String }],
    decisions: [{ type: String }],
    generatedAt: { type: Date }
  },
  
  // Recording metadata
  isRecording: { type: Boolean, default: false },
  recordingUrl: { type: String }
}, {
  timestamps: true
});

// Task Schema
const TaskSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', required: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }, // Optional - specific meeting
  
  // Task details
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedToName: { type: String }, // Store name directly for easier access
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  
  // AI metadata
  isAiGenerated: { type: Boolean, default: false },
  aiConfidence: { type: Number }, // 0-1 confidence score
  
  // Dates
  dueDate: { type: Date },
  completedAt: { type: Date },
  
  // Comments/updates
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Create indexes for better performance
UserSchema.index({ email: 1 });
MeetingRoomSchema.index({ createdBy: 1 });
MeetingSchema.index({ roomId: 1, startedAt: -1 });
TaskSchema.index({ roomId: 1, status: 1 });

// Models
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model('MeetingRoom', MeetingRoomSchema);
export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// ============= TYPE DEFINITIONS =============

export interface IUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  joinedAt: Date;
  lastActive: Date;
}

export interface IMeetingRoom {
  _id: string;
  roomName: string;
  title: string;
  description?: string;
  type: string;
  isRecurring: boolean;
  recurringPattern?: {
    frequency?: string;
    day?: string;
    time?: string;
    startDate?: Date;
    endDate?: Date;
  };
  participants: Array<{
    userId?: string;
    name: string;
    role: 'host' | 'member';
    joinedAt: Date;
    notes?: string;
  }>;
  meetings: string[];
  tasks: string[];
  createdBy?: string;
  lastMeetingAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMeeting {
  _id: string;
  roomId?: string; // Optional for one-off meetings
  roomName: string; // Unique identifier for LiveKit room
  title?: string;
  type: string;
  isOneOff: boolean;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  participants: Array<{
    userId?: string;
    name: string;
    joinedAt: Date;
    leftAt?: Date;
    isHost: boolean;
  }>;
  transcripts: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
    embedding?: number[];
  }>;
  summary?: {
    content: string;
    keyPoints: string[];
    actionItems: string[];
    decisions: string[];
    generatedAt: Date;
  };
  isRecording: boolean;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask {
  _id: string;
  roomId: string;
  meetingId?: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  assignedToName?: string;
  createdBy?: string;
  createdByName?: string;
  isAiGenerated: boolean;
  aiConfidence?: number;
  dueDate?: Date;
  completedAt?: Date;
  comments: Array<{
    userId?: string;
    userName: string;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// ============= FRONTEND MAPPING FUNCTIONS =============

// Transform database MeetingRoom to frontend MeetingRoomCard format
export function toMeetingRoomCard(room: IMeetingRoom, meetingCount?: number): {
  id: string;
  title: string;
  type: string;
  description?: string;
  participantCount: number;
  lastActivity?: Date;
  isActive: boolean;
  recentMeetings?: number;
} {
  return {
    id: room.roomName, // Use roomName as id for URLs
    title: room.title,
    type: room.type,
    description: room.description,
    participantCount: room.participants.length,
    lastActivity: room.lastMeetingAt || room.updatedAt,
    isActive: room.isActive,
    recentMeetings: meetingCount || room.meetings.length
  };
}

// Transform frontend CreateMeetingPopup form to database MeetingRoom format
export function fromCreateMeetingForm(formData: {
  roomName: string;
  title: string;
  type: string;
  isRecurring: boolean;
  participants: string[];
  startDate?: string;
  endDate?: string;
  frequency?: string;
  recurringDay?: string;
  recurringTime?: string;
}, createdBy?: string): Partial<IMeetingRoom> {
  return {
    roomName: formData.roomName,
    title: formData.title,
    type: formData.type,
    isRecurring: formData.isRecurring,
    recurringPattern: formData.isRecurring ? {
      frequency: formData.frequency,
      day: formData.frequency === 'daily' ? undefined : formData.recurringDay,
      time: formData.recurringTime,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined
    } : undefined,
    participants: formData.participants
      .filter(name => name.trim())
      .map(name => ({
        name: name.trim(),
        role: 'member' as const,
        joinedAt: new Date()
      })),
    createdBy,
    isActive: false,
    meetings: [],
    tasks: []
  };
}

// Transform meeting to OneOffMeeting format for the frontend
export function toOneOffMeeting(meeting: IMeeting): {
  id: string;
  roomName: string;
  title?: string;
  type: string;
  startedAt: Date;
  endedAt?: Date;
  participantCount: number;
  duration?: number;
  hasTranscripts: boolean;
  hasSummary: boolean;
} {
  return {
    id: meeting._id,
    roomName: meeting.roomName,
    title: meeting.title,
    type: meeting.type,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    participantCount: meeting.participants.length,
    duration: meeting.duration,
    hasTranscripts: meeting.transcripts.length > 0,
    hasSummary: !!meeting.summary?.content
  };
}

// ============= DATABASE SERVICE CLASS =============

export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async ensureConnection() {
    await connectToDatabase();
  }

  // ===== MEETING ROOM OPERATIONS =====
  
  async createMeetingRoom(roomData: Partial<IMeetingRoom>): Promise<IMeetingRoom> {
    await this.ensureConnection();
    const room = new MeetingRoom(roomData);
    const savedRoom = await room.save();
    return savedRoom.toObject() as IMeetingRoom;
  }

  async getMeetingRooms(): Promise<IMeetingRoom[]> {
    await this.ensureConnection();
    
    const rooms = await MeetingRoom.find({}).lean();
    return rooms as unknown as IMeetingRoom[];
  }
  
  async getMeetingRoom(roomId: string): Promise<IMeetingRoom | null> {
    await this.ensureConnection();
    
    const room = await MeetingRoom.findById(roomId).lean();
    return room as IMeetingRoom | null;
  }
  
  async getMeetingRoomByName(roomName: string): Promise<IMeetingRoom | null> {
    await this.ensureConnection();
    
    const room = await MeetingRoom.findOne({ roomName }).lean();
    return room as IMeetingRoom | null;
  }

  async getAllMeetingRooms(limit?: number): Promise<IMeetingRoom[]> {
    await this.ensureConnection();
    const query = MeetingRoom.find()
      .sort({ lastMeetingAt: -1, updatedAt: -1 })
      .populate('meetings')
      .populate('tasks')
      .lean();
    
    if (limit) {
      query.limit(limit);
    }
    
    const rooms = await query.exec();
    return rooms as unknown as IMeetingRoom[];
  }

  async updateMeetingRoom(roomName: string, updates: Partial<IMeetingRoom>): Promise<IMeetingRoom | null> {
    await this.ensureConnection();
    const room = await MeetingRoom.findOneAndUpdate(
      { roomName },
      { $set: updates },
      { new: true }
    ).lean();
    return room as unknown as IMeetingRoom | null;
  }

  async deleteMeetingsByRoom(roomId: string): Promise<number> {
    await this.ensureConnection();
    
    const result = await Meeting.deleteMany({ roomId });
    return result.deletedCount || 0;
  }
  
  async deleteMeetingRoom(roomId: string): Promise<boolean> {
    await this.ensureConnection();
    
    const result = await MeetingRoom.findByIdAndDelete(roomId);
    return !!result;
  }

  // ===== MEETING OPERATIONS =====

  async createMeeting(meetingData: Partial<IMeeting>): Promise<IMeeting> {
    await this.ensureConnection();
    const meeting = new Meeting(meetingData);
    const savedMeeting = await meeting.save();

    // Update the meeting room's meetings array and lastMeetingAt
    if (meetingData.roomId) {
      await MeetingRoom.findByIdAndUpdate(meetingData.roomId, {
        $push: { meetings: savedMeeting._id },
        $set: { lastMeetingAt: meetingData.startedAt || new Date() }
      });
    }

    return savedMeeting.toObject() as IMeeting;
  }

  async getMeetingsByRoom(roomId: string, limit?: number): Promise<IMeeting[]> {
    await this.ensureConnection();
    const query = Meeting.find({ roomId })
      .sort({ startedAt: -1 })
      .lean();
    
    if (limit) {
      query.limit(limit);
    }
    
    const meetings = await query.exec();
    return meetings as unknown as IMeeting[];
  }

  // ===== TASK OPERATIONS =====

  async createTask(taskData: Partial<ITask>): Promise<ITask> {
    await this.ensureConnection();
    const task = new Task(taskData);
    const savedTask = await task.save();

    // Update the meeting room's tasks array
    if (taskData.roomId) {
      await MeetingRoom.findByIdAndUpdate(taskData.roomId, {
        $push: { tasks: savedTask._id }
      });
    }

    return savedTask.toObject() as ITask;
  }

  async getTasksByRoom(roomId: string): Promise<ITask[]> {
    await this.ensureConnection();
    const tasks = await Task.find({ roomId })
      .sort({ createdAt: -1 })
      .lean();
    return tasks as unknown as ITask[];
  }

  async updateTask(taskId: string, updates: Partial<ITask>): Promise<ITask | null> {
    await this.ensureConnection();
    const task = await Task.findByIdAndUpdate(
      taskId,
      { $set: updates },
      { new: true }
    ).lean();
    return task as unknown as ITask | null;
  }

  async getTaskById(taskId: string): Promise<ITask | null> {
    await this.ensureConnection();
    const task = await Task.findById(taskId).lean();
    return task as unknown as ITask | null;
  }

  async deleteTask(taskId: string): Promise<ITask | null> {
    await this.ensureConnection();
    
    // Get the task before deleting to return it and get roomId
    const task = await Task.findById(taskId).lean() as unknown as ITask;
    if (!task) {
      return null;
    }

    // Remove from database
    await Task.findByIdAndDelete(taskId);

    // Remove from meeting room's tasks array
    if (task.roomId) {
      await MeetingRoom.findByIdAndUpdate(task.roomId, {
        $pull: { tasks: taskId }
      });
    }

    return task;
  }

  async addCommentToTask(taskId: string, comment: {
    userId?: string;
    userName: string;
    text: string;
    createdAt: Date;
  }): Promise<ITask | null> {
    await this.ensureConnection();
    
    const task = await Task.findByIdAndUpdate(
      taskId,
      { 
        $push: { 
          comments: comment 
        },
        $set: {
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();
    
    return task as unknown as ITask | null;
  }

  // ===== USER OPERATIONS =====

  async createOrGetUser(name: string, email?: string): Promise<IUser> {
    await this.ensureConnection();
    
    // Try to find existing user by name or email
    const existingUser = await User.findOne({
      $or: [
        { name: name },
        ...(email ? [{ email: email }] : [])
      ]
    }).lean();

    if (existingUser) {
      // Update lastActive
      await User.findByIdAndUpdate((existingUser as any)._id, {
        $set: { lastActive: new Date() }
      });
      return existingUser as unknown as IUser;
    }

    // Create new user
    const user = new User({ name, email, lastActive: new Date() });
    const savedUser = await user.save();
    return savedUser.toObject() as IUser;
  }

  // ============= ONE-OFF MEETING METHODS =============
  
  async createOneOffMeeting(meetingData: {
    roomName: string;
    title?: string;
    type?: string;
    participantName?: string;
  }): Promise<IMeeting> {
    await this.ensureConnection();
    
    const meeting = new Meeting({
      roomName: meetingData.roomName,
      title: meetingData.title || 'Instant Meeting',
      type: meetingData.type || 'Instant Meeting',
      isOneOff: true,
      startedAt: new Date(),
      participants: meetingData.participantName ? [{
        name: meetingData.participantName,
        joinedAt: new Date(),
        isHost: true
      }] : []
    });
    
    const savedMeeting = await meeting.save();
    return savedMeeting.toObject() as IMeeting;
  }
  
  async getOneOffMeetings(limit?: number): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const query = Meeting.find({ isOneOff: true })
      .sort({ startedAt: -1 });
    
    if (limit) {
      query.limit(limit);
    }
    
    const meetings = await query.lean();
    return meetings as unknown as IMeeting[];
  }
  
  async getOneOffMeeting(roomName: string): Promise<IMeeting | null> {
    await this.ensureConnection();
    
    const meeting = await Meeting.findOne({ 
      roomName, 
      isOneOff: true 
    }).lean();
    
    return meeting as IMeeting | null;
  }

  // ============= ADDITIONAL MEETING METHODS =============
  
  async getMeetingById(meetingId: string): Promise<IMeeting | null> {
    await this.ensureConnection();
    
    const meeting = await Meeting.findById(meetingId).lean();
    return meeting as IMeeting | null;
  }
  
  async updateMeeting(meetingId: string, updates: Partial<IMeeting>): Promise<IMeeting | null> {
    await this.ensureConnection();
    
    const meeting = await Meeting.findByIdAndUpdate(
      meetingId,
      { $set: updates },
      { new: true }
    ).lean();
    
    return meeting as unknown as IMeeting | null;
  }
  
  async getMeetingsByRoomWithFilters(options: {
    roomId: string;
    limit?: number;
    skip?: number;
    type?: string | null;
    dateQuery?: Record<string, any>;
  }): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const { roomId, limit = 50, skip = 0, type, dateQuery = {} } = options;
    
    // Build query
    const query: Record<string, any> = { 
      roomId,
      ...dateQuery
    };
    
    // Add type filter if provided
    if (type) {
      query.type = type;
    }
    
    const meetings = await Meeting.find(query)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    return meetings as unknown as IMeeting[];
  }

  // ============= RECURRING MEETING METHODS =============
  
  /**
   * Calculate the next upcoming meeting date for a recurring room
   */
  calculateNextMeetingDate(room: IMeetingRoom): Date | null {
    if (!room.isRecurring || !room.recurringPattern) {
      return null;
    }
    
    const { frequency, day, time, startDate, endDate } = room.recurringPattern;
    
    if (!frequency || !time) {
      return null;
    }
    
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    // If we have an end date and it's passed, no upcoming meetings
    if (endDate && now > endDate) {
      return null;
    }
    
    // Calculate next occurrence based on frequency
    let nextDate = new Date();
    
    // Set the time
    nextDate.setHours(hours, minutes, 0, 0);
    
    if (frequency === 'daily') {
      // For daily meetings, just check if today's meeting time has passed
      if (nextDate <= now) {
        // Move to tomorrow
        nextDate.setDate(nextDate.getDate() + 1);
      }
    } else {
      // For other frequencies, we need a specific day
      if (!day) {
        return null;
      }
      
      // Find the next occurrence of the specified day
      const dayIndex = this.getDayIndex(day);
      const currentDayIndex = nextDate.getDay();
      
      let daysUntilNext = dayIndex - currentDayIndex;
      if (daysUntilNext <= 0 || (daysUntilNext === 0 && nextDate <= now)) {
        // If it's today but time has passed, or it's in the past, move to next week
        daysUntilNext += 7;
      }
      
      nextDate.setDate(nextDate.getDate() + daysUntilNext);
      
      // Handle different frequencies
      if (frequency === 'biweekly') {
        // For biweekly, we need to check if this is the right week
        if (startDate) {
          const weeksSinceStart = Math.floor((nextDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (weeksSinceStart % 2 !== 0) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
      } else if (frequency === 'monthly') {
        // For monthly, find the next occurrence of the day in the month
        const startOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
        const firstOccurrence = new Date(startOfMonth);
        const firstDayIndex = firstOccurrence.getDay();
        const daysToFirst = (dayIndex - firstDayIndex + 7) % 7;
        firstOccurrence.setDate(1 + daysToFirst);
        
        // Find which week of the month the pattern started
        if (startDate) {
          const startWeekOfMonth = Math.ceil(startDate.getDate() / 7);
          const targetDate = new Date(firstOccurrence);
          targetDate.setDate(firstOccurrence.getDate() + (startWeekOfMonth - 1) * 7);
          
          if (targetDate >= now) {
            nextDate = targetDate;
          } else {
            // Move to next month
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 1);
            nextDate.setDate(1 + daysToFirst + (startWeekOfMonth - 1) * 7);
          }
        }
      }
    }
    
    // Make sure we don't exceed the end date
    if (endDate && nextDate > endDate) {
      return null;
    }
    
    return nextDate;
  }
  
  private getDayIndex(day: string): number {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.indexOf(day);
  }
  
  /**
   * Generate historical meetings for a recurring room for testing
   */
  async generateRecurringMeetingHistory(roomId: string, weeksBack: number = 8): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const room = await MeetingRoom.findById(roomId).lean() as unknown as IMeetingRoom;
    if (!room || !room.isRecurring || !room.recurringPattern) {
      throw new Error('Room is not a recurring meeting room');
    }
    
    const { frequency, day, time } = room.recurringPattern;
    if (!frequency || !day || !time) {
      throw new Error('Invalid recurring pattern');
    }
    
    const [hours, minutes] = time.split(':').map(Number);
    const dayIndex = this.getDayIndex(day);
    const meetings: IMeeting[] = [];
    
    // Generate meetings going backwards from current week
    for (let week = 1; week <= weeksBack; week++) {
      // Skip some meetings randomly to make it more realistic
      if (Math.random() < 0.15) continue; // 15% chance to skip a meeting
      
      const meetingDate = new Date();
      meetingDate.setDate(meetingDate.getDate() - (week * 7));
      
      // Adjust to the correct day of week
      const currentDay = meetingDate.getDay();
      const daysToAdjust = dayIndex - currentDay;
      meetingDate.setDate(meetingDate.getDate() + daysToAdjust);
      meetingDate.setHours(hours, minutes, 0, 0);
      
      // Skip future dates
      if (meetingDate > new Date()) continue;
      
      // Generate meeting duration (25-60 minutes)
      const duration = Math.floor(Math.random() * 35) + 25;
      const endTime = new Date(meetingDate.getTime() + duration * 60 * 1000);
      
      // Generate random participants from room participants
      const meetingParticipants = room.participants
        .filter(() => Math.random() < 0.8) // 80% chance each participant joins
        .map(p => ({
          userId: p.userId,
          name: p.name,
          joinedAt: meetingDate,
          leftAt: endTime,
          isHost: p.role === 'host'
        }));
      
      const meeting: Partial<IMeeting> = {
        roomId: roomId,
        roomName: room.roomName,
        title: room.title,
        type: room.type,
        isOneOff: false,
        startedAt: meetingDate,
        endedAt: endTime,
        duration: duration,
        participants: meetingParticipants,
        transcripts: [],
        summary: Math.random() < 0.7 ? { // 70% chance of having a summary
          content: this.generateMockSummary(room.type),
          keyPoints: this.generateMockKeyPoints(),
          actionItems: this.generateMockActionItems(),
          decisions: this.generateMockDecisions(),
          generatedAt: endTime
        } : undefined,
        isRecording: false
      };
      
      const savedMeeting = await this.createMeeting(meeting);
      meetings.push(savedMeeting);
    }
    
    return meetings;
  }
  
  private generateMockSummary(meetingType: string): string {
    const summaries = {
      'Daily Standup': [
        'Team discussed current sprint progress, identified blockers, and aligned on priorities for the day.',
        'Quick sync on yesterday\'s achievements and today\'s goals. Addressed technical challenges and dependencies.',
        'Daily standup covered completed tasks, upcoming work, and team coordination for ongoing projects.'
      ],
      'Project Planning': [
        'Strategic planning session focused on project roadmap, resource allocation, and timeline optimization.',
        'Comprehensive project review including scope definition, milestone planning, and risk assessment.',
        'Planning meeting covered project objectives, deliverables, and cross-team collaboration strategies.'
      ],
      'Client Review': [
        'Client presentation and feedback session covering recent deliverables and upcoming milestones.',
        'Review meeting with stakeholders to demonstrate progress and gather requirements for next phase.',
        'Client sync focused on project status, deliverable quality, and adjustment of priorities based on feedback.'
      ]
    };
    
    const typesSummaries = summaries[meetingType as keyof typeof summaries] || summaries['Daily Standup'];
    return typesSummaries[Math.floor(Math.random() * typesSummaries.length)];
  }
  
  private generateMockKeyPoints(): string[] {
    const keyPoints = [
      'Sprint velocity is on track with planned estimates',
      'New feature deployment scheduled for next week',
      'Database optimization showing 40% performance improvement',
      'Client feedback incorporated into current iteration',
      'Team capacity adjusted for upcoming holiday period',
      'Integration testing completed successfully',
      'Code review process streamlined with new tools',
      'Documentation updates pushed to knowledge base'
    ];
    
    const count = Math.floor(Math.random() * 3) + 2; // 2-4 key points
    return keyPoints.sort(() => 0.5 - Math.random()).slice(0, count);
  }
  
  private generateMockActionItems(): string[] {
    const actions = [
      'Update project timeline based on current progress',
      'Schedule follow-up meeting with stakeholders',
      'Complete code review for pending pull requests',
      'Prepare demo for client presentation',
      'Update documentation for new features',
      'Coordinate with QA team for testing schedule',
      'Set up monitoring for production deployment',
      'Create tickets for identified technical debt'
    ];
    
    const count = Math.floor(Math.random() * 4) + 1; // 1-4 action items
    return actions.sort(() => 0.5 - Math.random()).slice(0, count);
  }
  
  private generateMockDecisions(): string[] {
    const decisions = [
      'Approved moving forward with proposed architecture changes',
      'Decided to postpone feature X to next sprint',
      'Agreed on new deployment schedule for better stability',
      'Confirmed resource allocation for Q1 objectives',
      'Selected technology stack for upcoming project phase'
    ];
    
    const count = Math.floor(Math.random() * 3); // 0-2 decisions
    return decisions.sort(() => 0.5 - Math.random()).slice(0, count);
  }
} 