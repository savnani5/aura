// Main Library Exports - Organized by module
// This provides a clean API for importing from the lib folder

// AI Module - All AI-related services
export * from './ai';

// Database Module - All database services
export * from './database';

// Services Module - All external services
export { TranscriptionService, EmailService, StripeService } from './services';

// Components Module - All UI components have been moved to /components directory
// Use: import { ComponentName } from '@/components/category';

// Utils Module - All utility functions
export * from './utils';

// State Module - State management (already organized)
export * from './state';

// Types Module - Type definitions (already organized)
export * from './types'; 