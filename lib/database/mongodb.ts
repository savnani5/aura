import mongoose from 'mongoose';

function getMongoDBURI(): string {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }
  return MONGODB_URI;
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
    
    cached.promise = mongoose.connect(getMongoDBURI(), opts)
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
  lastActive: { type: Date, default: Date.now },
  
  // Affiliate tracking
  referredBy: { type: String }, // Referrer identifier (simple string)
  
  // Stripe subscription fields
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'incomplete', 'incomplete_expired', 'trialing', 'past_due', 'canceled', 'unpaid', null],
    default: null 
  },
  subscriptionCurrentPeriodEnd: { type: Date },
  subscriptionCreatedAt: { type: Date },
  trialEndsAt: { type: Date }
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
    duration: { type: Number }, // Meeting duration in minutes (e.g., 30, 60, 90)
    timezone: { type: String }, // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
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
    title: { type: String }, // Add title field
    content: { type: String },
    sections: [{
      title: { type: String },
      points: [{
        text: { type: String },
        speaker: { type: String },
        context: {
          speaker: { type: String }, // Who said this
          reasoning: { type: String }, // Why they said it / context around it
          transcriptExcerpt: { type: String }, // The actual transcript excerpt
          relatedDiscussion: { type: String } // Surrounding discussion for context
        }
      }]
    }],
    keyPoints: [{ type: String }], // Keep for backward compatibility
    actionItems: [{ 
      title: { type: String },
      owner: { type: String },
      priority: { type: String },
      dueDate: { type: String }, // Store as string since it can be null
      context: { type: String }
    }],
    decisions: [{ type: String }],
    generatedAt: { type: Date }
  },
  
  // Recording metadata
  isRecording: { type: Boolean, default: false },
  recordingUrl: { type: String },
  
  // Performance metadata
  transcriptCount: { type: Number, default: 0 }, // Cache transcript count
  hasEmbeddings: { type: Boolean, default: false }, // Flag to know if embeddings exist
  embeddingsGeneratedAt: { type: Date }, // When embeddings were last generated
  embeddingError: { type: String }, // Error message if embedding generation failed
  embeddingErrorAt: { type: Date }, // When embedding generation failed
  
  // Processing status for async background processing
  processingStatus: { type: String, enum: ['pending', 'in_progress', 'summary_completed', 'completed', 'failed'] },
  processingStartedAt: { type: Date },
  summaryGeneratedAt: { type: Date },
  processingCompletedAt: { type: Date },
  processingFailedAt: { type: Date },
  processingError: { type: String }
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
  
  // Review status for AI-generated tasks
  reviewStatus: { type: String, enum: ['pending_review', 'reviewed', 'exported'], default: 'pending_review' },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  exportedAt: { type: Date },
  exportedTo: { type: String }, // 'jira', 'linear', 'asana', 'csv', etc.
  
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
  
  // Meeting metadata (for display)
  meetingTitle: { type: String },
  meetingDate: { type: Date },
  
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

// Create indexes for better performance (remove duplicates)
UserSchema.index({ email: 1 });
// Remove clerkId index since it's already created by unique: true
MeetingRoomSchema.index({ createdBy: 1 });
// Remove roomName index since it's already created by unique: true
MeetingRoomSchema.index({ isActive: 1, lastMeetingAt: -1 });
MeetingSchema.index({ roomId: 1, startedAt: -1 });
MeetingSchema.index({ roomName: 1, startedAt: -1 });
TaskSchema.index({ roomId: 1, status: 1 });
TaskSchema.index({ roomId: 1, createdAt: -1 });

// TranscriptEmbedding schema removed - we now use Pinecone for all embeddings
// This eliminates duplicate storage and improves performance

// Models
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model('MeetingRoom', MeetingRoomSchema);
export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
// TranscriptEmbedding model removed - using Pinecone for all embeddings

// ============= TYPE DEFINITIONS =============

export interface IUser {
  _id: string;
  clerkId: string;
  name: string;
  email?: string;
  avatar?: string;
  joinedAt: Date;
  lastActive: Date;
  // Affiliate tracking
  referredBy?: string;
  // Stripe subscription fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | null;
  subscriptionCurrentPeriodEnd?: Date;
  subscriptionCreatedAt?: Date;
  trialEndsAt?: Date;
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
    duration?: number;
    timezone?: string;
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
    // Enhanced fields for speaker diarization
    speakerConfidence?: number;
    deepgramSpeaker?: number;
    participantId?: string;
    isLocal?: boolean;
  }>;
  summary?: {
    title?: string;
    content: string;
    sections?: Array<{
      title: string;
      points: Array<{
        text: string;
        speaker?: string;
        context?: {
          speaker: string; // Who said this
          reasoning: string; // Why they said it / context around it
          transcriptExcerpt: string; // The actual transcript excerpt
          relatedDiscussion: string; // Surrounding discussion for context
        };
      }>;
    }>;
    keyPoints: string[]; // Keep for backward compatibility
    actionItems: Array<{
      title: string;
      owner: string;
      priority: string;
      dueDate?: string;
      context: string;
    }>;
    decisions: string[];
    generatedAt: Date;
  };
  isRecording: boolean;
  recordingUrl?: string;
  isLive?: boolean; // Flag to indicate if meeting is currently in progress
  
  // Performance metadata
  transcriptCount?: number; // Cache transcript count
  hasEmbeddings?: boolean; // Flag to know if embeddings exist
  embeddingsGeneratedAt?: Date; // When embeddings were last generated
  embeddingError?: string; // Error message if embedding generation failed
  embeddingErrorAt?: Date; // When embedding generation failed
  
  // Processing status for async background processing
  processingStatus?: 'pending' | 'in_progress' | 'summary_completed' | 'completed' | 'failed';
  processingStartedAt?: Date;
  summaryGeneratedAt?: Date;
  processingCompletedAt?: Date;
  processingFailedAt?: Date;
  processingError?: string;
  
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
  reviewStatus?: 'pending_review' | 'reviewed' | 'exported';
  reviewedAt?: Date;
  reviewedBy?: string;
  exportedAt?: Date;
  exportedTo?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdBy?: string;
  createdByName?: string;
  isAiGenerated: boolean;
  aiConfidence?: number;
  dueDate?: Date;
  completedAt?: Date;
  meetingTitle?: string;
  meetingDate?: Date;
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
  objectId: string; // Add MongoDB ObjectId for database queries
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
    objectId: room._id.toString(), // MongoDB ObjectId for database queries
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
  recurringDuration?: number;
  recurringTimezone?: string;
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
      duration: formData.recurringDuration || 60, // Default to 60 minutes if not specified
      timezone: formData.recurringTimezone,
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
  
  // ENHANCED: Comprehensive method to delete meeting room and all associated data
  async deleteMeetingRoom(roomId: string): Promise<{
    success: boolean;
    deletedCounts: {
      room: number;
      meetings: number;
      tasks: number;
      embeddings: number;
    };
  }> {
    await this.ensureConnection();
    
    let deletedCounts = {
      room: 0,
      meetings: 0,
      tasks: 0,
      embeddings: 0
    };
    
    try {
      // Step 1: Get all meetings in this room to know which embeddings to delete
      const meetings = await Meeting.find({ roomId }).select('_id').lean();
      const meetingIds = meetings.map(m => (m._id as any).toString());
      
      // Step 2: Delete embeddings from Pinecone for this room
      try {
        const { PineconeService } = await import('../ai/pinecone');
        const pineconeService = PineconeService.getInstance();
        await pineconeService.deleteTranscriptsByRoom(roomId);
        deletedCounts.embeddings = 1; // Mark as cleaned up
      } catch (error) {
        console.error('Error deleting Pinecone embeddings for room:', error);
        deletedCounts.embeddings = 0;
      }
      
      // Step 3: Delete all meetings in this room
      const meetingResult = await Meeting.deleteMany({ roomId });
      deletedCounts.meetings = meetingResult.deletedCount || 0;
      
      // Step 4: Delete all tasks in this room
      const taskResult = await Task.deleteMany({ roomId });
      deletedCounts.tasks = taskResult.deletedCount || 0;
      
      // Step 5: Finally delete the meeting room itself
      const roomResult = await MeetingRoom.findByIdAndDelete(roomId);
      deletedCounts.room = roomResult ? 1 : 0;
      
      return {
        success: true,
        deletedCounts
      };
    } catch (error) {
      console.error('Error in comprehensive room deletion:', error);
      return {
        success: false,
        deletedCounts
      };
    }
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

  // Embeddings are now stored in Pinecone only

  // NEW: Get meetings by array of IDs
  async getMeetingsByIds(meetingIds: string[]): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const meetings = await Meeting.find({
      _id: { $in: meetingIds }
    })
    .select('-transcripts.embedding') // Exclude embeddings for performance
    .lean();
    
    return meetings as unknown as IMeeting[];
  }

  // Embeddings are now stored in Pinecone only - this method is no longer needed
  async deleteEmbeddings(meetingId: string): Promise<void> {
    await this.ensureConnection();
    
    // Just update meeting metadata - embeddings are deleted from Pinecone elsewhere
    await Meeting.findByIdAndUpdate(meetingId, {
      hasEmbeddings: false,
      transcriptCount: 0,
      embeddingsGeneratedAt: null
    });
  }

  // NEW: Get all meetings that have embeddings (for migration)
  async getMeetingsWithEmbeddings(): Promise<IMeeting[]> {
    await this.ensureConnection();
    
    const meetings = await Meeting.find({
      hasEmbeddings: true,
      transcriptCount: { $gt: 0 }
    })
    .select('-transcripts.embedding') // Exclude embeddings for performance
    .sort({ startedAt: -1 })
    .lean();
    
    return meetings as unknown as IMeeting[];
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

  // Get all tasks for a user across all their workspaces
  async getTasksByUser(userId: string, options?: {
    reviewStatus?: 'pending_review' | 'reviewed' | 'exported';
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    limit?: number;
    skip?: number;
  }): Promise<ITask[]> {
    await this.ensureConnection();
    
    // First find the user by Clerk ID to get their ObjectId
    const user = await User.findOne({ clerkId: userId }).select('_id');
    if (!user) {
      console.log(`👤 User not found for Clerk ID: ${userId}`);
      return [];
    }
    
    // Then get all rooms where user is participant or creator
    const userRooms = await MeetingRoom.find({
      $or: [
        { createdBy: user._id },
        { 'participants.userId': user._id }
      ]
    }).select('_id').lean();
    
    const roomIds = userRooms.map(room => room._id);
    
    // Build query for tasks
    const query: any = { roomId: { $in: roomIds } };
    
    if (options?.reviewStatus) {
      query.reviewStatus = options.reviewStatus;
    }
    if (options?.status) {
      query.status = options.status;
    }
    if (options?.priority) {
      query.priority = options.priority;
    }
    
    const tasksQuery = Task.find(query)
      .sort({ createdAt: -1 })
      .populate('meetingId', 'title startedAt')
      .populate('roomId', 'title');
    
    if (options?.skip) {
      tasksQuery.skip(options.skip);
    }
    if (options?.limit) {
      tasksQuery.limit(options.limit);
    }
    
    const tasks = await tasksQuery.lean();
    
    // Enhance tasks with meeting metadata
    return tasks.map(task => {
      const enhancedTask = task as unknown as ITask;
      if (task.meetingId && typeof task.meetingId === 'object') {
        enhancedTask.meetingTitle = (task.meetingId as any).title;
        enhancedTask.meetingDate = (task.meetingId as any).startedAt;
      }
      return enhancedTask;
    });
  }

  // Bulk update tasks (for marking as reviewed/exported)
  async bulkUpdateTasks(taskIds: string[], updates: Partial<ITask>): Promise<number> {
    await this.ensureConnection();
    
    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      { $set: updates }
    );
    
    return result.modifiedCount || 0;
  }

  // ===== USER OPERATIONS =====

  async createUser(userData: {
    clerkId: string;
    name: string;
    email?: string;
    avatar?: string;
    joinedAt: Date;
    lastActive: Date;
    referredBy?: string;
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
  
  // NEW: Check for active meeting in a room (meeting without endedAt)
  async getActiveMeetingByRoom(roomName: string): Promise<IMeeting | null> {
    await this.ensureConnection();
    
    const activeMeeting = await Meeting.findOne({
      roomName,
      endedAt: { $exists: false } // Meeting has not ended yet
    })
    .sort({ startedAt: -1 }) // Get the most recent active meeting
    .lean();
    
    return activeMeeting as IMeeting | null;
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
  

  
  // Get monthly meeting count for a user
  async getMonthlyMeetingCount(userId: string, year?: number, month?: number): Promise<number> {
    await this.ensureConnection();
    
    try {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month || now.getMonth(); // 0-based month
      
      // Get start and end of the target month
      const startOfMonth = new Date(targetYear, targetMonth, 1);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
      
      // Get all meeting rooms for this user
      const userRooms = await MeetingRoom.find({ createdBy: userId }).select('_id').lean();
      const roomIds = userRooms.map(room => room._id);
      
      // Count meetings in user's rooms for this month
      const count = await Meeting.countDocuments({
        roomId: { $in: roomIds },
        startedAt: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error getting monthly meeting count:', error);
      return 0;
    }
  }

  // Check if user has exceeded monthly meeting limit
  async hasExceededMeetingLimit(userId: string, limit: number = 10): Promise<{
    exceeded: boolean;
    currentCount: number;
    limit: number;
    remaining: number;
  }> {
    await this.ensureConnection();
    
    try {
      const currentCount = await this.getMonthlyMeetingCount(userId);
      const exceeded = currentCount >= limit;
      const remaining = Math.max(0, limit - currentCount);
      
      return {
        exceeded,
        currentCount,
        limit,
        remaining
      };
    } catch (error) {
      console.error('Error checking meeting limit:', error);
      return {
        exceeded: false,
        currentCount: 0,
        limit,
        remaining: limit
      };
    }
  }
  
  async deleteMeeting(meetingId: string): Promise<boolean> {
    await this.ensureConnection();
    
    try {
      // First, get the meeting to know which room it belongs to
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        console.log(`⚠️ Meeting not found for deletion: ${meetingId}`);
        return false;
      }

      console.log(`🗑️ Starting comprehensive deletion of meeting: ${meetingId}`);

      // Step 1: Delete all tasks associated with this meeting
      const taskDeleteResult = await Task.deleteMany({ meetingId });
      console.log(`✅ Deleted ${taskDeleteResult.deletedCount} tasks for meeting ${meetingId}`);

      // Step 2: Delete transcript embeddings from Pinecone
      try {
        const { HybridRAGService } = await import('@/lib/ai/hybrid-rag');
        const hybridRAG = HybridRAGService.getInstance();
        await hybridRAG.deleteEmbeddings(meetingId);
        console.log(`✅ Deleted embeddings from Pinecone for meeting ${meetingId}`);
      } catch (embeddingError) {
        console.error(`⚠️ Error deleting embeddings for meeting ${meetingId}:`, embeddingError);
        // Don't fail the entire operation if embedding deletion fails
      }

      // Step 3: Remove the meeting from the meeting room's meetings array
      await MeetingRoom.findByIdAndUpdate(
        meeting.roomId,
        { $pull: { meetings: meetingId } },
        { new: true }
      );
      console.log(`✅ Removed meeting ${meetingId} from room ${meeting.roomId}`);

      // Step 4: Delete the meeting document itself
      const deleteResult = await Meeting.findByIdAndDelete(meetingId);
      
      if (deleteResult) {
        console.log(`✅ Successfully deleted meeting and all associated data: ${meetingId}`);
        return true;
      }
      
      console.log(`⚠️ Failed to delete meeting document: ${meetingId}`);
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

  // ============= SUBSCRIPTION MANAGEMENT METHODS =============

  /**
   * Update user's subscription information from Stripe
   */
  async updateUserSubscription(clerkId: string, subscriptionData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: 'active' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | null;
    subscriptionCurrentPeriodEnd?: Date;
    subscriptionCreatedAt?: Date;
    trialEndsAt?: Date;
  }): Promise<IUser | null> {
    await this.ensureConnection();

    const updateData: any = { ...subscriptionData };
    
    const updatedUser = await User.findOneAndUpdate(
      { clerkId },
      { $set: updateData },
      { new: true }
    ).lean() as unknown as IUser;

    console.log(`📋 Updated subscription for user ${clerkId}:`, subscriptionData);
    return updatedUser;
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(clerkId: string): Promise<boolean> {
    await this.ensureConnection();

    const user = await User.findOne({ clerkId }).lean() as unknown as IUser;
    
    if (!user) return false;

    // Check if subscription is active or trialing
    const isActive = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
    
    // For trialing, also check if trial hasn't expired
    if (user.subscriptionStatus === 'trialing' && user.trialEndsAt) {
      return isActive && new Date() < user.trialEndsAt;
    }

    // For active, check if current period hasn't ended
    if (user.subscriptionStatus === 'active' && user.subscriptionCurrentPeriodEnd) {
      return isActive && new Date() < user.subscriptionCurrentPeriodEnd;
    }

    return isActive;
  }

  /**
   * Get user's subscription details
   */
  async getUserSubscription(clerkId: string): Promise<{
    hasActiveSubscription: boolean;
    subscriptionStatus?: string;
    trialEndsAt?: Date;
    subscriptionCurrentPeriodEnd?: Date;
    stripeCustomerId?: string;
  } | null> {
    await this.ensureConnection();

    const user = await User.findOne({ clerkId }).lean() as unknown as IUser;
    
    if (!user) return null;

    const hasActiveSubscription = await this.hasActiveSubscription(clerkId);

    return {
      hasActiveSubscription,
      subscriptionStatus: user.subscriptionStatus || undefined,
      trialEndsAt: user.trialEndsAt,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  /**
   * Get user by Stripe customer ID - for webhook processing
   */
  async getUserByStripeCustomerId(customerId: string): Promise<IUser | null> {
    return await withDatabaseConnection(async () => {
      await this.ensureConnection();
      const user = await User.findOne({ stripeCustomerId: customerId }).lean();
      return user as IUser | null;
    }, 'getUserByStripeCustomerId');
  }

  /**
   * Update user subscription by Stripe customer ID - for webhook processing
   */
  async updateUserSubscriptionByCustomerId(customerId: string, subscriptionData: {
    stripeSubscriptionId?: string;
    subscriptionStatus?: 'active' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | null;
    subscriptionCurrentPeriodEnd?: Date;
    subscriptionCreatedAt?: Date;
    trialEndsAt?: Date;
  }): Promise<IUser | null> {
    return await withDatabaseConnection(async () => {
      await this.ensureConnection();
      const user = await User.findOneAndUpdate(
        { stripeCustomerId: customerId },
        { $set: subscriptionData },
        { new: true }
      ).lean();
      return user as IUser | null;
    }, 'updateUserSubscriptionByCustomerId');
  }

  // ============= AFFILIATE TRACKING METHODS =============

  /**
   * Get all users referred by a specific affiliate code
   */
  async getUsersByReferralCode(referralCode: string): Promise<Array<{
    _id: string;
    name: string;
    email?: string;
    joinedAt: Date;
    subscriptionStatus?: string;
    hasActiveSubscription: boolean;
  }>> {
    await this.ensureConnection();

    const users = await User.find({ referredBy: referralCode })
      .sort({ joinedAt: -1 })
      .lean() as unknown as IUser[];

    return users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      joinedAt: user.joinedAt,
      subscriptionStatus: user.subscriptionStatus || 'none',
      hasActiveSubscription: user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing'
    }));
  }

  /**
   * Get affiliate statistics - summary of referrals and conversions
   */
  async getAffiliateStats(referralCode?: string): Promise<Array<{
    referralCode: string;
    totalReferrals: number;
    subscribedReferrals: number;
    conversionRate: number;
    latestReferral?: Date;
  }>> {
    await this.ensureConnection();

    const pipeline: any[] = [
      {
        $match: referralCode 
          ? { referredBy: referralCode }
          : { referredBy: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$referredBy',
          totalReferrals: { $sum: 1 },
          subscribedReferrals: {
            $sum: {
              $cond: [
                { $in: ['$subscriptionStatus', ['active', 'trialing']] },
                1,
                0
              ]
            }
          },
          latestReferral: { $max: '$joinedAt' }
        }
      },
      {
        $project: {
          referralCode: '$_id',
          totalReferrals: 1,
          subscribedReferrals: 1,
          conversionRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$subscribedReferrals', '$totalReferrals'] },
                  100
                ]
              },
              2
            ]
          },
          latestReferral: 1,
          _id: 0
        }
      },
      {
        $sort: { totalReferrals: -1 }
      }
    ];

    const stats = await User.aggregate(pipeline);
    return stats;
  }
} 