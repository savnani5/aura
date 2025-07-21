// Database Services - Centralized exports for all database-related functionality
export { DatabaseService } from './mongodb';
export { connectToDatabase } from './mongodb';

// Re-export types and interfaces
export type { 
  IUser,
  IMeetingRoom,
  IMeeting,
  ITask
} from './mongodb'; 