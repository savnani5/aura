import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  isConnecting: boolean;
}

// Global mongoose cache for serverless environments
declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { 
  conn: null, 
  promise: null,
  isConnecting: false
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

// Serverless-optimized connection function
export async function connectToDatabase(): Promise<typeof mongoose> {
  // If we have a healthy connection, return it immediately
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection is in a bad state, reset everything
  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log('🔄 Resetting stale MongoDB connection for serverless');
    cached.conn = null;
    cached.promise = null;
    cached.isConnecting = false;
  }

  // Prevent concurrent connections in serverless
  if (cached.isConnecting) {
    // Wait for the existing connection attempt
    if (cached.promise) {
      return await cached.promise;
    }
  }

  // If no connection exists, create one
  if (!cached.promise) {
    cached.isConnecting = true;
    
    // Serverless-optimized MongoDB options
    const opts = {
      bufferCommands: false, // Critical for serverless - don't buffer commands
      
      // Aggressive timeouts for serverless (faster failure = better UX)
      serverSelectionTimeoutMS: 5000, // 5 seconds max to select server
      socketTimeoutMS: 10000, // 10 seconds socket timeout
      connectTimeoutMS: 5000, // 5 seconds to connect
      
      // Minimal connection pool for serverless
      maxPoolSize: 1, // Single connection per function instance
      minPoolSize: 0, // No minimum connections
      maxIdleTimeMS: 5000, // Close idle connections quickly
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      
      // Heartbeat for connection health
      heartbeatFrequencyMS: 30000, // Check every 30 seconds
    };

    console.log('🔌 Connecting to MongoDB (serverless mode)');
    
    cached.promise = mongoose.connect(MONGODB_URI!, opts)
      .then((mongooseInstance) => {
        cached.isConnecting = false;
        console.log('✅ MongoDB connected successfully (serverless)');
        return mongooseInstance;
      })
      .catch((error) => {
        cached.isConnecting = false;
        cached.promise = null;
        console.error('❌ MongoDB connection failed:', error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    cached.isConnecting = false;
    throw e;
  }
}

// Simplified health check for serverless
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    return mongoose.connection.readyState === 1;
  } catch {
    return false;
  }
}

// Graceful disconnection for serverless cleanup
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    cached.isConnecting = false;
    console.log('🔌 MongoDB disconnected (serverless cleanup)');
  }
}

// Serverless wrapper function that handles common connection issues
export async function withDatabaseConnection<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation'
): Promise<T> {
  try {
    // Ensure we have a connection
    await connectToDatabase();
    
    // Execute the operation
    const result = await operation();
    
    return result;
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    
    // If it's a connection error, reset the cache for next time
    if (error instanceof Error && (
      error.message.includes('connection') ||
      error.message.includes('timeout') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNRESET')
    )) {
      console.log('🔄 Resetting connection cache due to connection error');
      cached.conn = null;
      cached.promise = null;
      cached.isConnecting = false;
    }
    
    throw error;
  }
}

// ============= SCHEMAS & MODELS =============

// User Schema
const UserSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true }, // Clerk user ID
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
  
  // Participants - Updated to support email-based invitations
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Set when user signs up
    email: { type: String, required: true }, // Always store email for invitations
    name: { type: String, required: true }, // Store name directly for easier access
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    notes: { type: String }, // Individual participant notes
    invitedAt: { type: Date, default: Date.now }, // When they were invited
    linkedAt: { type: Date } // When they linked their account (signed up)
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
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', required: true },
  
  // Meeting details
  roomName: { type: String, required: true }, // Unique identifier for the meeting (for LiveKit room)
  title: { type: String }, // Override room title if needed
  type: { type: String, default: 'Meeting' }, // 'Daily Standup', 'Project Review', etc.
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
  
  // Transcripts WITHOUT embeddings for faster loading
  transcripts: [{
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    // Remove embedding from here - it's now in separate collection
    // embedding: [{ type: Number }] // REMOVED
    
    // Enhanced fields for speaker diarization
    speakerConfidence: { type: Number },
    deepgramSpeaker: { type: Number },
    participantId: { type: String },
    isLocal: { type: Boolean }
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
  recordingUrl: { type: String },
  
  // Performance metadata
  transcriptCount: { type: Number, default: 0 }, // Cache transcript count
  hasEmbeddings: { type: Boolean, default: false } // Flag to know if embeddings exist
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
UserSchema.index({ clerkId: 1 });
MeetingRoomSchema.index({ createdBy: 1 });
MeetingRoomSchema.index({ roomName: 1 }); // Critical for room lookups
MeetingRoomSchema.index({ isActive: 1, lastMeetingAt: -1 });
MeetingSchema.index({ roomId: 1, startedAt: -1 });
MeetingSchema.index({ roomName: 1, startedAt: -1 });
TaskSchema.index({ roomId: 1, status: 1 });
TaskSchema.index({ roomId: 1, createdAt: -1 });

// New separate schema for embeddings to avoid loading them unnecessarily
const TranscriptEmbeddingSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  transcriptIndex: { type: Number, required: true }, // Index within the meeting's transcripts array
  speaker: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: true },
  embedding: [{ type: Number }], // The vector embeddings
  
  // Metadata for faster filtering
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', required: true },
  meetingDate: { type: Date, required: true }
}, {
  timestamps: true
});

// Indexes for embedding collection
TranscriptEmbeddingSchema.index({ meetingId: 1, transcriptIndex: 1 });
TranscriptEmbeddingSchema.index({ roomId: 1, meetingDate: -1 });
TranscriptEmbeddingSchema.index({ meetingId: 1 });

// Update the transcripts schema to remove embeddings
const TranscriptsSchemaUpdated = [{
  speaker: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: true },
  // Remove embedding from here - it's now in separate collection
  // embedding: [{ type: Number }] // REMOVED
  
  // Enhanced fields for speaker diarization
  speakerConfidence: { type: Number },
  deepgramSpeaker: { type: Number },
  participantId: { type: String },
  isLocal: { type: Boolean }
}];

// Update Meeting Schema to use the new transcripts structure
const MeetingSchemaUpdated = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', required: true },
  roomName: { type: String, required: true }, // For LiveKit room management
  
  // Meeting metadata
  title: { type: String },
  type: { type: String, default: 'Meeting' }, // 'Daily Standup', 'Project Review', etc.
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
  
  // Transcripts WITHOUT embeddings for faster loading
  transcripts: TranscriptsSchemaUpdated,
  
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
  recordingUrl: { type: String },
  
  // Performance metadata
  transcriptCount: { type: Number, default: 0 }, // Cache transcript count
  hasEmbeddings: { type: Boolean, default: false } // Flag to know if embeddings exist
}, {
  timestamps: true
});

// Models
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model('MeetingRoom', MeetingRoomSchema);
export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchemaUpdated);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
export const TranscriptEmbedding = mongoose.models.TranscriptEmbedding || mongoose.model('TranscriptEmbedding', TranscriptEmbeddingSchema);

// ============= TYPE DEFINITIONS =============

export interface IUser {
  _id: string;
  clerkId: string;
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
    userId?: string; // Set when user signs up
    email: string; // Always store email for invitations
    name: string;
    role: 'host' | 'member';
    joinedAt: Date;
    notes?: string;
    invitedAt: Date; // When they were invited
    linkedAt?: Date; // When they linked their account (signed up)
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
  roomId: string; // Required - all meetings must be associated with a meeting room
  roomName: string; // Unique identifier for LiveKit room
  title?: string;
  type: string;
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
    // Enhanced fields for speaker diarization
    speakerConfidence?: number;
    deepgramSpeaker?: number;
    participantId?: string;
    isLocal?: boolean;
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
  
  // Performance metadata
  transcriptCount?: number; // Cache transcript count
  hasEmbeddings?: boolean; // Flag to know if embeddings exist
  
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
  participants: Array<{email: string, name: string, role: string}>;
  startDate?: string;
  endDate?: string;
  frequency?: string;
  recurringDay?: string;
  recurringTime?: string;
}, createdBy?: string): Partial<IMeetingRoom> {
  // Create participants array from the frontend participant objects
  const participants: Array<{
    userId?: string;
    email: string;
    name: string;
    role: 'host' | 'member';
    joinedAt: Date;
    notes?: string;
    invitedAt: Date;
    linkedAt?: Date;
  }> = formData.participants
    .filter(p => p.email.trim()) // Filter out empty participants
    .map(p => ({
      userId: p.role === 'host' ? createdBy : undefined, // Set userId for host
      email: p.email.trim(),
      name: p.name.trim() || p.email.trim(), // Use name if provided, otherwise use email
      role: p.role === 'host' ? 'host' : 'member',
      joinedAt: new Date(),
      invitedAt: new Date(),
      linkedAt: p.role === 'host' ? new Date() : undefined // Host is already linked
    }));

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
    participants,
    createdBy,
    isActive: false,
    meetings: [],
    tasks: []
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

  async ensureConnection(retries: number = 2): Promise<void> {
    // In serverless, we want fast failure and retry
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Check if already connected
        if (await isDatabaseConnected()) {
          return;
        }
        
        // Try to establish connection
        await connectToDatabase();
        
        // Verify connection is working
        if (await isDatabaseConnected()) {
          return; // Success
        } else {
          throw new Error('Connection established but verification failed');
        }
      } catch (error) {
        console.error(`❌ Database connection attempt ${attempt}/${retries} failed:`, error);
        
        // Clear cache on failure for fresh retry
        cached.conn = null;
        cached.promise = null;
        cached.isConnecting = false;
        
        if (attempt === retries) {
          throw new Error(`Serverless DB connection failed after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Short delay for serverless (we want fast failure)
        const delay = attempt * 500; // 500ms, 1000ms
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ===== MEETING ROOM OPERATIONS =====
  
  async createMeetingRoom(roomData: Partial<IMeetingRoom>): Promise<IMeetingRoom> {
    return withDatabaseConnection(async () => {
      const room = new MeetingRoom(roomData);
      const savedRoom = await room.save();
      return savedRoom.toObject() as IMeetingRoom;
    }, 'createMeetingRoom');
  }

  async getMeetingRooms(): Promise<IMeetingRoom[]> {
    return withDatabaseConnection(async () => {
      const rooms = await MeetingRoom.find({}).lean();
      return rooms as unknown as IMeetingRoom[];
    }, 'getMeetingRooms');
  }
  
  async getMeetingRoom(roomId: string): Promise<IMeetingRoom | null> {
    return withDatabaseConnection(async () => {
      const room = await MeetingRoom.findById(roomId).lean();
      return room as IMeetingRoom | null;
    }, 'getMeetingRoom');
  }
  
  async getMeetingRoomByName(roomName: string): Promise<IMeetingRoom | null> {
    return withDatabaseConnection(async () => {
      const room = await MeetingRoom.findOne({ roomName }).lean();
      return room as IMeetingRoom | null;
    }, 'getMeetingRoomByName');
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
    
    // Query to only get meetings with content (transcripts or summary)
    const query = {
      roomId,
      $or: [
        { 'transcripts.0': { $exists: true } }, // Has at least one transcript
        { 
          $and: [
            { 'summary.content': { $exists: true } },
            { 'summary.content': { $ne: '' } },
            { 'summary.content': { $ne: null } }
          ]
        } // Has non-empty summary
      ]
    };
    
    // Optimized query - only get essential fields, no embeddings
    const meetings = await Meeting.find(query)
      .select('-transcripts.embedding') // Exclude embeddings for performance
      .sort({ startedAt: -1 })
      .limit(limit || 50)
      .lean();
    
    return meetings as unknown as IMeeting[];
  }

  // NEW: Optimized method for getting meeting metadata only (for dashboard/history)
  async getMeetingMetadata(roomId: string, options: {
    limit?: number;
    skip?: number;
    includeTranscripts?: boolean;
  } = {}): Promise<Array<Omit<IMeeting, 'transcripts'> & { transcriptCount: number }>> {
    await this.ensureConnection();
    
    const { limit = 50, skip = 0, includeTranscripts = false } = options;
    
    // Query to only get meetings with content (transcripts or summary)
    const query = {
      roomId,
      $or: [
        { 'transcripts.0': { $exists: true } }, // Has at least one transcript
        { 
          $and: [
            { 'summary.content': { $exists: true } },
            { 'summary.content': { $ne: '' } },
            { 'summary.content': { $ne: null } }
          ]
        } // Has non-empty summary
      ]
    };
    
    // Build projection - exclude transcripts by default for performance
    const projection: Record<string, number> = {
      roomId: 1,
      roomName: 1,
      title: 1,
      type: 1,
      startedAt: 1,
      endedAt: 1,
      duration: 1,
      participants: 1,
      summary: 1,
      isRecording: 1,
      transcriptCount: 1,
      hasEmbeddings: 1,
      createdAt: 1,
      updatedAt: 1
    };
    
    if (includeTranscripts) {
      projection['transcripts'] = 1;
    }
    
    const meetings = await Meeting.find(query)
      .select(projection)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    return meetings.map(meeting => ({
      ...meeting,
      transcriptCount: meeting.transcriptCount || meeting.transcripts?.length || 0
    })) as any;
  }

  // NEW: Get embeddings for specific meetings (only when needed for RAG)
  async getEmbeddingsByMeeting(meetingIds: string[]): Promise<Array<{
    meetingId: string;
    transcripts: Array<{
      transcriptIndex: number;
      speaker: string;
      text: string;
      timestamp: Date;
      embedding: number[];
    }>;
  }>> {
    await this.ensureConnection();
    
    const embeddings = await TranscriptEmbedding.find({
      meetingId: { $in: meetingIds }
    })
    .sort({ meetingId: 1, transcriptIndex: 1 })
    .lean();
    
    // Group by meeting
    const groupedEmbeddings: Record<string, any[]> = {};
    embeddings.forEach(embedding => {
      const meetingId = embedding.meetingId.toString();
      if (!groupedEmbeddings[meetingId]) {
        groupedEmbeddings[meetingId] = [];
      }
      groupedEmbeddings[meetingId].push({
        transcriptIndex: embedding.transcriptIndex,
        speaker: embedding.speaker,
        text: embedding.text,
        timestamp: embedding.timestamp,
        embedding: embedding.embedding
      });
    });
    
    return Object.entries(groupedEmbeddings).map(([meetingId, transcripts]) => ({
      meetingId,
      transcripts
    }));
  }

  // NEW: Store embeddings separately
  async storeEmbeddings(meetingId: string, transcripts: Array<{
    transcriptIndex: number;
    speaker: string;
    text: string;
    timestamp: Date;
    embedding: number[];
  }>): Promise<void> {
    await this.ensureConnection();
    
    const meeting = await Meeting.findById(meetingId).lean() as any;
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    
    // Delete existing embeddings for this meeting
    await TranscriptEmbedding.deleteMany({ meetingId });
    
    // Insert new embeddings
    const embeddingDocs = transcripts.map(transcript => ({
      meetingId,
      transcriptIndex: transcript.transcriptIndex,
      speaker: transcript.speaker,
      text: transcript.text,
      timestamp: transcript.timestamp,
      embedding: transcript.embedding,
      roomId: meeting.roomId,
      meetingDate: meeting.startedAt
    }));
    
    if (embeddingDocs.length > 0) {
      await TranscriptEmbedding.insertMany(embeddingDocs);
      
      // Update meeting to mark it has embeddings
      await Meeting.findByIdAndUpdate(meetingId, {
        hasEmbeddings: true,
        transcriptCount: transcripts.length
      });
    }
  }

  // UPDATED: Optimized method that uses the new metadata approach
  async getMeetingsByRoomWithFilters(options: {
    roomId: string;
    limit?: number;
    skip?: number;
    type?: string | null;
    dateQuery?: Record<string, any>;
    includeTranscripts?: boolean;
  }): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const { roomId, limit = 50, skip = 0, type, dateQuery = {}, includeTranscripts = false } = options;
    
    // Build query
    const query: Record<string, any> = { 
      roomId,
      ...dateQuery
    };
    
    // Add type filter if provided
    if (type) {
      query.type = type;
    }
    
    // Build projection based on whether transcripts are needed
    let projection = {};
    if (!includeTranscripts) {
      projection = {
        'transcripts.embedding': 0 // Exclude embeddings even if transcripts are included
      };
    }
    
    const meetings = await Meeting.find(query, projection)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
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

  async createUser(userData: {
    clerkId: string;
    name: string;
    email?: string;
    avatar?: string;
    joinedAt: Date;
    lastActive: Date;
  }): Promise<IUser> {
    return withDatabaseConnection(async () => {
      try {
        const user = new User(userData);
        const savedUser = await user.save();
        return savedUser.toObject() as IUser;
      } catch (error: any) {
        // Handle duplicate key error (E11000)
        if (error.code === 11000 && error.keyPattern?.clerkId) {
          console.log(`User with clerkId ${userData.clerkId} already exists, returning existing user`);
          // Return the existing user instead of throwing an error
          const existingUser = await User.findOne({ clerkId: userData.clerkId }).lean();
          if (existingUser) {
            return existingUser as unknown as IUser;
          }
        }
        
        console.error('Error creating user:', error);
        throw error;
      }
    }, 'createUser');
  }

  async getUserByClerkId(clerkId: string): Promise<IUser | null> {
    return withDatabaseConnection(async () => {
      try {
        const user = await User.findOne({ clerkId }).lean();
        return user as IUser | null;
      } catch (error) {
        console.error('Error finding user by clerkId:', error);
        return null;
      }
    }, 'getUserByClerkId');
  }

  async updateUser(clerkId: string, updates: Partial<IUser>): Promise<IUser | null> {
    await this.ensureConnection();
    
    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: { ...updates, lastActive: new Date() } },
      { new: true }
    ).lean();
    
    return user as IUser | null;
  }

  async deleteUser(clerkId: string): Promise<IUser | null> {
    await this.ensureConnection();
    
    const user = await User.findOneAndDelete({ clerkId }).lean();
    return user as IUser | null;
  }

  async createOrGetUser(name: string, email?: string): Promise<IUser> {
    await this.ensureConnection();
    
    // Try to find by email first (for invitation system)
    if (email) {
      const existingUser = await User.findOne({ email }).lean();
      if (existingUser) {
        return existingUser as unknown as IUser;
      }
    }

    // Create new user (fallback for non-Clerk users)
    const user = new User({ 
      clerkId: `temp-${Date.now()}`, // Temporary ID for non-Clerk users
      name, 
      email, 
      lastActive: new Date() 
    });
    const savedUser = await user.save();
    return savedUser.toObject() as IUser;
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
  
  async deleteMeeting(meetingId: string): Promise<boolean> {
    await this.ensureConnection();
    
    try {
      // First delete any associated embeddings
      await TranscriptEmbedding.deleteMany({ meetingId });
      
      // Then delete the meeting itself
      const deleteResult = await Meeting.findByIdAndDelete(meetingId);
      
      if (deleteResult) {
        console.log(`✅ Deleted meeting and associated embeddings: ${meetingId}`);
        return true;
      }
      
      console.log(`⚠️ Meeting not found for deletion: ${meetingId}`);
      return false;
    } catch (error) {
      console.error(`❌ Error deleting meeting ${meetingId}:`, error);
      throw error;
    }
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

      // Generate mock transcripts for the meeting
      const transcripts = this.generateMockTranscripts(
        meetingParticipants.map(p => p.name), 
        room.type, 
        meetingDate,
        duration
      );
      
      const meeting: Partial<IMeeting> = {
        roomId: roomId,
        roomName: room.roomName,
        title: room.title,
        type: room.type,
        startedAt: meetingDate,
        endedAt: endTime,
        duration: duration,
        participants: meetingParticipants,
        transcripts: transcripts,
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

  private generateMockTranscripts(
    participants: string[], 
    meetingType: string, 
    meetingDate: Date,
    durationMinutes: number
  ): Array<{
    speaker: string;
    text: string;
    timestamp: Date;
    embedding?: number[];
  }> {
    const transcripts: Array<{
      speaker: string;
      text: string;
      timestamp: Date;
      embedding?: number[];
    }> = [];

    // Generate 15-30 transcript entries based on meeting duration
    const numTranscripts = Math.floor(durationMinutes / 2) + Math.floor(Math.random() * 10) + 5;
    
    // Transcript templates based on meeting type
    const transcriptTemplates = {
      'Daily Standup': [
        "Yesterday I completed the user authentication module and fixed the database connection issues.",
        "Today I'm planning to work on the API endpoints for user profile management.",
        "I'm blocked on the third-party integration - waiting for API keys from the vendor.",
        "The sprint is going well, we're about 70% complete with our planned features.",
        "I finished the code review for the payment system and it looks good to merge.",
        "Today I'll be focusing on the frontend components for the dashboard.",
        "No blockers for me today, everything is on track.",
        "I need help with the deployment pipeline - having some Docker issues.",
        "The testing suite is now covering 85% of our codebase which is great progress.",
        "I'll be pairing with [teammate] on the search functionality this afternoon."
      ],
      'Project Planning': [
        "Let's review the project timeline and see if we need to adjust any milestones.",
        "The client has requested some additional features - we need to evaluate the scope impact.",
        "Our current velocity suggests we can complete Phase 1 by the end of next month.",
        "We should allocate more resources to the testing phase based on complexity.",
        "The integration with the external API is taking longer than expected.",
        "Let's prioritize the core features first and move the nice-to-haves to Phase 2.",
        "We need to coordinate with the design team on the new user interface mockups.",
        "The database migration should be scheduled for the weekend to minimize downtime.",
        "Risk assessment shows we might need a backup plan for the cloud deployment.",
        "Budget tracking shows we're on target but need to monitor the external contractor costs.",
        "The MVP features are well-defined, we should focus on getting those rock solid.",
        "Quality assurance will need an extra week for thorough testing of the payment system."
      ],
      'Client Review': [
        "The client is happy with the progress on the user dashboard functionality.",
        "They've requested a few UI changes to better match their brand guidelines.",
        "The performance improvements are meeting their expectations - 40% faster load times.",
        "We need to clarify the requirements for the reporting module.",
        "The client wants to add mobile support to the scope for this quarter.",
        "Security audit results look good, just a few minor recommendations to implement.",
        "They're impressed with the new analytics features and want to expand them.",
        "The deployment went smoothly and users are adapting well to the new interface.",
        "Client feedback on the beta version is very positive overall.",
        "We should schedule a demo of the upcoming features for their stakeholders."
      ]
    };

    const templates = transcriptTemplates[meetingType as keyof typeof transcriptTemplates] || transcriptTemplates['Daily Standup'];
    
    for (let i = 0; i < numTranscripts; i++) {
      // Pick a random participant
      const speaker = participants[Math.floor(Math.random() * participants.length)];
      
      // Pick a random template and customize it
      let text = templates[Math.floor(Math.random() * templates.length)];
      
      // Replace [teammate] placeholder with actual participant name
      if (text.includes('[teammate]')) {
        const otherParticipants = participants.filter(p => p !== speaker);
        const teammate = otherParticipants[Math.floor(Math.random() * otherParticipants.length)] || 'the team';
        text = text.replace('[teammate]', teammate);
      }
      
      // Calculate timestamp within the meeting duration
      const minutesIntoMeeting = Math.floor((i / numTranscripts) * durationMinutes);
      const timestamp = new Date(meetingDate.getTime() + minutesIntoMeeting * 60 * 1000);
      
      transcripts.push({
        speaker,
        text,
        timestamp,
        // Note: embeddings will be generated later by the RAG service
      });
    }

    return transcripts;
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

  // ============= USER-SPECIFIC DATA METHODS =============
  
  /**
   * Get meeting rooms where the user is a participant or creator
   * This includes rooms where they were invited by email before signing up
   */
  async getMeetingRoomsByUser(userId: string, userEmail?: string, limit?: number): Promise<IMeetingRoom[]> {
    await this.ensureConnection();
    
    // Build query to find rooms where user is participant by userId, email, or creator
    const query: any = {
      $or: [
        { 'participants.userId': userId }, // User is linked as participant
        { createdBy: userId } // User is the creator
      ]
    };
    
    // If user email is provided, also search by email for unlinked invitations
    if (userEmail) {
      query.$or.push({ 'participants.email': userEmail });
    }
    
    const queryBuilder = MeetingRoom.find(query).sort({ lastMeetingAt: -1, updatedAt: -1 });
    
    if (limit) {
      queryBuilder.limit(limit);
    }
    
    return await queryBuilder.lean() as unknown as IMeetingRoom[];
  }
  
  /**
   * Check if user is participant in a meeting room
   */
  async isUserParticipant(roomId: string, userId: string): Promise<boolean> {
    await this.ensureConnection();
    
    const room = await MeetingRoom.findOne({
      _id: roomId,
      'participants.userId': userId
    }).lean();
    
    return !!room;
  }

  /**
   * Link a user to meeting rooms where they were invited by email
   * This should be called when a user signs up or updates their email
   */
  async linkUserToInvitedRooms(userId: string, userEmail: string): Promise<number> {
    await this.ensureConnection();
    
    // Find all rooms where this email is a participant but not yet linked
    const result = await MeetingRoom.updateMany(
      { 
        'participants.email': userEmail,
        'participants.userId': { $exists: false }
      },
      { 
        $set: { 
          'participants.$.userId': userId,
          'participants.$.linkedAt': new Date()
        }
      }
    );
    
    console.log(`🔗 Linked user ${userId} to ${result.modifiedCount} meeting rooms via email ${userEmail}`);
    return result.modifiedCount || 0;
  }

  // NEW: Get real-time meeting count for a room
  async getRealMeetingCountByRoom(roomId: string): Promise<number> {
    await this.ensureConnection();
    
    // Count actual meetings with content for this room
    const count = await Meeting.countDocuments({
      roomId,
      $or: [
        { 'transcripts.0': { $exists: true } }, // Has at least one transcript
        { 
          $and: [
            { 'summary.content': { $exists: true } },
            { 'summary.content': { $ne: '' } },
            { 'summary.content': { $ne: null } }
          ]
        } // Has non-empty summary
      ]
    });
    
    return count;
  }

  // NEW: Get real-time meeting counts for multiple rooms
  async getRealMeetingCountsByRooms(roomIds: string[]): Promise<Record<string, number>> {
    await this.ensureConnection();
    
    const pipeline = [
      {
        $match: {
          roomId: { $in: roomIds.map(id => id) },
          $or: [
            { 'transcripts.0': { $exists: true } },
            { 
              $and: [
                { 'summary.content': { $exists: true } },
                { 'summary.content': { $ne: '' } },
                { 'summary.content': { $ne: null } }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: '$roomId',
          count: { $sum: 1 }
        }
      }
    ];
    
    const results = await Meeting.aggregate(pipeline);
    
    // Convert to Record<string, number> format
    const countMap: Record<string, number> = {};
    roomIds.forEach(roomId => {
      countMap[roomId] = 0; // Default to 0
    });
    
    results.forEach((result: any) => {
      countMap[result._id.toString()] = result.count;
    });
    
    return countMap;
  }

  // NEW: Clean up stale meeting references from meeting room
  async cleanupMeetingRoomReferences(roomId: string): Promise<number> {
    await this.ensureConnection();
    
    // Get all actual meeting IDs for this room
    const actualMeetings = await Meeting.find({ roomId }).select('_id').lean() as Array<{ _id: any }>;
    const actualMeetingIds = actualMeetings.map(m => m._id.toString());
    
    // Update the meeting room to only include existing meetings
    const result = await MeetingRoom.findByIdAndUpdate(
      roomId,
      { $set: { meetings: actualMeetingIds } },
      { new: true }
    );
    
    return actualMeetingIds.length;
  }

  // NEW: Clean up all meeting room references
  async cleanupAllMeetingRoomReferences(): Promise<{ updated: number; totalCleaned: number }> {
    await this.ensureConnection();
    
    const rooms = await MeetingRoom.find({}).lean() as Array<{ _id: any; meetings?: string[] }>;
    let totalCleaned = 0;
    let updated = 0;
    
    for (const room of rooms) {
      const cleanedCount = await this.cleanupMeetingRoomReferences(room._id.toString());
      const originalCount = room.meetings?.length || 0;
      
      if (originalCount !== cleanedCount) {
        updated++;
        totalCleaned += (originalCount - cleanedCount);
      }
    }
    
    return { updated, totalCleaned };
  }
} 