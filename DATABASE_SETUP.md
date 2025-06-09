# Ohm v1 Database Setup

## Overview

Ohm v1 adds persistent data storage with PostgreSQL and Prisma, enabling:
- Meeting persistence with custom meeting types (users can define any type name)
- Task management with AI assistance
- Transcript storage with vector embeddings
- Meeting history and context

## Quick Setup

### 1. Database Setup

You'll need PostgreSQL running locally or use a cloud service like Neon, Supabase, or Railway.

**Local PostgreSQL:**
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb ohm_db
```

**Or use a cloud service:**
- [Neon](https://neon.tech) (recommended for dev)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

### 2. Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ohm_db?schema=public"
# For cloud services, use the connection string they provide

# Existing variables
ANTHROPIC_API_KEY="your_key_here"
OPENAI_API_KEY="your_key_here"
NEXT_PUBLIC_DEEPGRAM_API_KEY="your_key_here"
LIVEKIT_API_KEY="your_key_here"
LIVEKIT_API_SECRET="your_key_here"
LIVEKIT_URL="your_livekit_url"
```

### 3. Install Dependencies & Setup Database

```bash
# Install new dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# (Optional) View database in Prisma Studio
npx prisma studio
```

## New Features in V1

### 1. Meeting Types & Persistence

When creating a meeting, users can now define custom meeting types such as:
- **"Daily Standup"**: Team standup meetings
- **"One-on-One"**: 1:1 meetings between two people
- **"Project Planning"**: Project-specific meetings
- **"Client Review"**: Client meetings
- **"Sprint Retrospective"**: Agile retrospectives
- **Or any custom type name users want**

The system is completely flexible - users can create any meeting type name they need.

### 2. Task Management

Each meeting room now has a task management system:
- Create/edit/delete tasks
- Assign to meeting participants
- Set priorities (HIGH/MEDIUM/LOW)
- Due dates and status tracking
- AI-generated tasks from meeting content

### 3. Enhanced AI Assistant

The AI assistant now has:
- Access to complete meeting history
- Vector search across transcripts
- Context-aware responses
- Task generation capabilities

### 4. Improved Transcription

- Better speaker identification using LiveKit participant data
- Real-time transcript storage with embeddings
- Persistent transcript history

## API Endpoints

### Meetings
- `GET /api/meetings` - List all meetings
- `POST /api/meetings` - Create new meeting
- `GET /api/meetings/[roomName]` - Get meeting details
- `POST /api/meetings/[roomName]` - Join meeting
- `PUT /api/meetings/[roomName]` - Update meeting

### Tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks` - Update task
- `DELETE /api/tasks?taskId=...` - Delete task

### AI Chat (Enhanced)
- `POST /api/ai-chat` - Chat with AI assistant
- `PUT /api/ai-chat` - Store transcript context

## Database Schema

The schema includes:
- **meetings**: Core meeting data
- **meeting_participants**: Who joined when
- **transcripts**: Spoken content with embeddings
- **tasks**: Action items and todos
- **meeting_summaries**: AI-generated summaries
- **vector_embeddings**: For future optimizations

## Development Commands

```bash
# Reset database (WARNING: Deletes all data)
npx prisma db push --force-reset

# Add new migrations
npx prisma migrate dev --name description_here

# View database
npx prisma studio

# Seed database with test data (if seed script exists)
npx prisma db seed
```

## Next Steps

1. Test meeting creation with types
2. Try the new task management features
3. Use the enhanced AI assistant
4. Set up recurring meetings
5. Explore meeting history

## Troubleshooting

**Database connection issues:**
- Check your DATABASE_URL format
- Ensure PostgreSQL is running
- Verify credentials and database exists

**Prisma errors:**
- Run `npx prisma generate` after schema changes
- Use `npx prisma db push` to sync schema changes
- Check Prisma logs for detailed error messages

**Missing features:**
- Ensure all environment variables are set
- Check that the API routes are accessible
- Verify the database has the latest schema 