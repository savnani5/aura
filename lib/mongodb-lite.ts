import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Minimal cache for serverless
let cached: mongoose.Mongoose | null = null;

// Ultra-fast connection for Vercel
export async function connectDB(): Promise<mongoose.Mongoose> {
  if (cached && mongoose.connection.readyState === 1) {
    return cached;
  }

  // Reset if connection is bad
  if (mongoose.connection.readyState === 3) {
    cached = null;
  }

  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 3000, // 3 seconds max
    socketTimeoutMS: 5000,
    connectTimeoutMS: 3000,
    maxPoolSize: 1,
    minPoolSize: 0,
    maxIdleTimeMS: 3000,
  };

  try {
    cached = await mongoose.connect(MONGODB_URI, opts);
    return cached;
  } catch (error) {
    cached = null;
    throw error;
  }
}

// Type definitions for better TypeScript support
export interface IUser {
  _id: string;
  clerkId: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMeetingRoom {
  _id: string;
  roomName: string;
  title: string;
  description?: string;
  type: string;
  isRecurring: boolean;
  participants: Array<{
    userId?: string;
    email: string;
    name: string;
    role: 'host' | 'member';
  }>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMeeting {
  _id: string;
  roomId?: string;
  roomName: string;
  title?: string;
  type: string;
  isOneOff: boolean;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  participants: Array<{
    userId?: string;
    name: string;
    isHost: boolean;
  }>;
  transcripts: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
  }>;
  summary?: {
    content: string;
    keyPoints: string[];
    actionItems: string[];
    decisions: string[];
    generatedAt: Date;
  };
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
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Minimal schemas - only what we need
const UserSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  avatar: { type: String },
}, { timestamps: true });

const MeetingRoomSchema = new mongoose.Schema({
  roomName: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true },
  isRecurring: { type: Boolean, default: false },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['host', 'member'], default: 'member' },
  }],
  isActive: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const MeetingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom' },
  roomName: { type: String, required: true },
  title: { type: String },
  type: { type: String, default: 'Meeting' },
  isOneOff: { type: Boolean, default: false },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  duration: { type: Number },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    isHost: { type: Boolean, default: false }
  }],
  transcripts: [{
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
  }],
  summary: {
    content: { type: String },
    keyPoints: [{ type: String }],
    actionItems: [{ type: String }],
    decisions: [{ type: String }],
    generatedAt: { type: Date }
  },
}, { timestamps: true });

const TaskSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', required: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedToName: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  dueDate: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

// Models
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model('MeetingRoom', MeetingRoomSchema);
export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// Fast database operations - direct queries only
export class FastDB {
  static async withConnection<T>(operation: () => Promise<T>): Promise<T> {
    await connectDB();
    return operation();
  }

  // Meeting Rooms
  static async createRoom(data: Partial<IMeetingRoom>): Promise<IMeetingRoom> {
    return this.withConnection(async () => {
      const room = new MeetingRoom(data);
      const saved = await room.save();
      return saved.toObject() as IMeetingRoom;
    });
  }

  static async getRoomByName(roomName: string): Promise<IMeetingRoom | null> {
    return this.withConnection(async () => {
      const room = await MeetingRoom.findOne({ roomName }).lean();
      return room as IMeetingRoom | null;
    });
  }

  static async getAllRooms(): Promise<IMeetingRoom[]> {
    return this.withConnection(async () => {
      const rooms = await MeetingRoom.find({}).sort({ updatedAt: -1 }).lean();
      return rooms as IMeetingRoom[];
    });
  }

  static async updateRoom(roomName: string, updates: Partial<IMeetingRoom>): Promise<IMeetingRoom | null> {
    return this.withConnection(async () => {
      const room = await MeetingRoom.findOneAndUpdate({ roomName }, updates, { new: true }).lean();
      return room as IMeetingRoom | null;
    });
  }

  // Users
  static async createUser(data: Partial<IUser>): Promise<IUser> {
    return this.withConnection(async () => {
      try {
        const user = new User(data);
        const saved = await user.save();
        return saved.toObject() as IUser;
      } catch (error: any) {
        if (error.code === 11000) {
          const existing = await User.findOne({ clerkId: data.clerkId }).lean();
          return existing as IUser;
        }
        throw error;
      }
    });
  }

  static async getUserByClerkId(clerkId: string): Promise<IUser | null> {
    return this.withConnection(async () => {
      const user = await User.findOne({ clerkId }).lean();
      return user as IUser | null;
    });
  }

  // Meetings
  static async createMeeting(data: Partial<IMeeting>): Promise<IMeeting> {
    return this.withConnection(async () => {
      const meeting = new Meeting(data);
      const saved = await meeting.save();
      return saved.toObject() as IMeeting;
    });
  }

  static async getMeetingsByRoom(roomId: string, limit = 10): Promise<IMeeting[]> {
    return this.withConnection(async () => {
      const meetings = await Meeting.find({ roomId }).sort({ startedAt: -1 }).limit(limit).lean();
      return meetings as IMeeting[];
    });
  }

  static async getMeetingById(meetingId: string): Promise<IMeeting | null> {
    return this.withConnection(async () => {
      const meeting = await Meeting.findById(meetingId).lean();
      return meeting as IMeeting | null;
    });
  }

  static async updateMeeting(meetingId: string, updates: Partial<IMeeting>): Promise<IMeeting | null> {
    return this.withConnection(async () => {
      const meeting = await Meeting.findByIdAndUpdate(meetingId, updates, { new: true }).lean();
      return meeting as IMeeting | null;
    });
  }

  // Tasks
  static async createTask(data: Partial<ITask>): Promise<ITask> {
    return this.withConnection(async () => {
      const task = new Task(data);
      const saved = await task.save();
      return saved.toObject() as ITask;
    });
  }

  static async getTasksByRoom(roomId: string): Promise<ITask[]> {
    return this.withConnection(async () => {
      const tasks = await Task.find({ roomId }).sort({ createdAt: -1 }).lean();
      return tasks as ITask[];
    });
  }

  static async updateTask(taskId: string, updates: Partial<ITask>): Promise<ITask | null> {
    return this.withConnection(async () => {
      const task = await Task.findByIdAndUpdate(taskId, updates, { new: true }).lean();
      return task as ITask | null;
    });
  }

  static async deleteTask(taskId: string): Promise<ITask | null> {
    return this.withConnection(async () => {
      const task = await Task.findByIdAndDelete(taskId).lean();
      return task as ITask | null;
    });
  }

  // One-off meetings
  static async createOneOffMeeting(data: Partial<IMeeting>): Promise<IMeeting> {
    return this.withConnection(async () => {
      const meeting = new Meeting({ ...data, isOneOff: true });
      const saved = await meeting.save();
      return saved.toObject() as IMeeting;
    });
  }

  static async getOneOffMeetings(limit = 10): Promise<IMeeting[]> {
    return this.withConnection(async () => {
      const meetings = await Meeting.find({ isOneOff: true }).sort({ startedAt: -1 }).limit(limit).lean();
      return meetings as IMeeting[];
    });
  }
} 