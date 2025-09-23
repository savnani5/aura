# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development Workflow
```bash
# Development
npm run dev              # Start development server with Next.js
npm run dev --turbo      # Start with Turbo for faster builds (recommended)

# Production
npm run build            # Build for production
npm run start            # Start production server

# Code Quality & Testing
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues automatically
npm run format:check     # Check Prettier formatting
npm run format:write     # Apply Prettier formatting

# Database & AI Operations
npm run migrate-pinecone # Migrate embeddings to Pinecone
npm run test-pinecone    # Test Pinecone vector database connection
npm run check-data       # Check existing meeting data integrity
```

### Environment Setup
This project requires extensive environment variables. Copy `.env.example` to `.env.local` and configure all required API keys. The application integrates with:
- LiveKit (video/audio infrastructure)
- MongoDB (primary database)
- Anthropic Claude (AI assistant)
- OpenAI (embeddings)
- Pinecone (vector search)
- Stripe (subscription billing)
- Clerk (authentication)
- Resend (email service)

## High-Level Architecture

### Core Technology Stack
- **Frontend**: Next.js 15 App Router with React 18, TypeScript, Tailwind CSS
- **Video Infrastructure**: LiveKit WebRTC with React components
- **Database**: MongoDB with Mongoose ODM and connection pooling for serverless
- **AI/ML**: Anthropic Claude + OpenAI embeddings + Pinecone vector search
- **Authentication**: Clerk with webhook-based user management
- **Payments**: Stripe with subscription management
- **State Management**: Zustand stores with persistence
- **Deployment**: Vercel-optimized serverless architecture

### Application Structure

#### Meeting-Centric Data Model
The app revolves around persistent **MeetingRooms** (workspaces) that contain multiple **Meetings** (individual sessions):

```
MeetingRoom (e.g., "weekly-standup")
├── Persistent workspace with participants
├── Recurring meeting patterns
├── Associated tasks and history
└── Multiple Meeting instances
    ├── Real-time transcripts
    ├── AI-generated summaries
    ├── Participant tracking
    └── Vector embeddings for search
```

#### Key Architectural Components

**Real-Time Meeting Flow:**
1. LiveKit handles WebRTC video/audio + real-time transcription
2. Meeting state stored in Zustand stores + MongoDB
3. AI processes transcripts in real-time for contextual assistance
4. Vector embeddings stored in Pinecone for semantic search
5. Post-meeting AI generates comprehensive summaries and action items

**AI-Powered Features:**
- **Hybrid RAG System**: Combines current meeting transcripts + historical context from Pinecone
- **Real-time Assistant**: Claude processes live meeting data for instant insights
- **Web Search Integration**: AI can fetch real-time information during meetings
- **Smart Context Management**: Maintains conversation history across meetings in same room

**Serverless Optimization:**
- MongoDB connection pooling with aggressive caching for Vercel
- Atomic database operations prevent race conditions in serverless functions
- LiveKit room state used instead of database participant tracking
- Optimized query patterns with selective field projection

### Critical Integration Points

#### LiveKit Integration (`lib/services/livekit-room-service.ts`)
- Manages real-time video rooms and participant tracking
- Provides authoritative source for active meeting state
- Handles room cleanup and participant disconnection

#### AI System (`lib/ai/`)
- **`chatbot.ts`**: Claude integration with conversation management
- **`hybrid-rag.ts`**: Combines current + historical meeting context
- **`pinecone.ts`**: Vector database for semantic meeting search
- **`embeddings.ts`**: OpenAI text embeddings generation

#### Database Layer (`lib/database/mongodb.ts`)
- Comprehensive MongoDB service with connection pooling
- Atomic operations for concurrent serverless execution
- Meeting room and meeting lifecycle management
- Task management with AI-generated action items

#### State Management (`lib/state/`)
- **Meeting Store**: Real-time meeting data, participant tracking, transcript storage
- **UI Store**: Modal management, preferences, toast notifications
- **Subscription Context**: Stripe billing integration with caching

### Authentication & Authorization
- Clerk handles user authentication with webhook-based user creation
- Middleware enforces route-based access control
- Guest access allowed for meeting rooms with email-based participant tracking
- Subscription-gated features controlled via Stripe integration

### Key Development Patterns

#### Serverless Database Operations
Always use the `withDatabaseConnection` wrapper or `DatabaseService` instance methods for database operations to handle connection pooling properly.

#### Real-Time State Management
The meeting store (`lib/state/meeting-store.ts`) replaces localStorage for meeting data persistence and provides utilities for meeting overlap prevention.

#### AI Context Management
When working with AI features, use the HybridRAGService to combine current meeting context with historical data from Pinecone for better responses.

#### Error Handling
The codebase implements graceful fallbacks throughout:
- AI model fallbacks (Claude 4 → Claude 3.5 Sonnet)
- Database connection retries with exponential backoff  
- LiveKit room state as authoritative source for participant data

## Common Development Tasks

### Adding New AI Capabilities
1. Extend the `AIChatbot` class in `lib/ai/chatbot.ts`
2. Update the hybrid RAG system if new context types needed
3. Add new tools to the Anthropic API configuration
4. Test with both Claude models for fallback compatibility

### Modifying Meeting Data Structure  
1. Update the MongoDB schemas in `lib/database/mongodb.ts`
2. Update TypeScript interfaces for type safety
3. Consider migration scripts for existing data
4. Update Pinecone vector storage if transcript structure changes

### Extending Subscription Features
1. Modify the SubscriptionContext for new plan types
2. Update Stripe webhook handlers in `app/api/webhooks/stripe/route.ts`
3. Add middleware checks for new feature access
4. Update the paywall modal components

### Performance Optimization
- Database queries use selective field projection to avoid loading embeddings
- Pinecone handles all vector operations separately from MongoDB
- LiveKit room state preferred over database participant tracking
- Aggressive connection pooling and caching for serverless environment

## Environment-Specific Notes

### Development
- Use `npm run dev --turbo` for fastest development builds
- LiveKit requires HTTPS in production but works with HTTP in development
- AI features require actual API keys - no local fallbacks implemented

### Production (Vercel)
- All environment variables must be set in Vercel dashboard
- MongoDB connection string should use connection pooling options
- Vercel function timeout configuration in `vercel.json` for long-running operations
- Consider Vercel's function duration limits for AI processing tasks

## Database Schema Highlights

### Meeting Rooms (Persistent Workspaces)
- Supports both one-time and recurring meeting patterns  
- Email-based participant system that links to users on signup
- Tracks meeting history and associated tasks

### Meetings (Individual Sessions)
- Stores transcripts without embeddings (Pinecone handles vectors)
- AI-generated summaries with structured sections and action items
- Processing status tracking for async operations

### Vector Embeddings (Pinecone)
- All meeting transcripts embedded for semantic search
- Room-based namespacing for efficient querying
- Metadata includes speaker, timestamp, and meeting context

## Testing & Debugging

### AI System Testing
- Use `npm run test-pinecone` to verify vector database connectivity
- Check `npm run test-pinecone-simple` for basic embedding operations
- Monitor console output for AI model fallback behavior

### Database Debugging
- Use `npm run check-data` to verify data integrity
- Database connection issues often resolve with connection pool reset
- Check MongoDB Atlas connection limits in production

### LiveKit Debugging
- Room state is authoritative - don't rely on database participant counts
- Check LiveKit dashboard for actual room activity
- Participant tracking discrepancies usually indicate stale database state