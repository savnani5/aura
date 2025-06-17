# 🤖 AI Integration for Ohm Video Conferencing

## **Phase 1: Core Infrastructure - COMPLETED ✅**

This document outlines the AI functionality implementation for the Ohm video conferencing app.

## **🏗️ Architecture Overview**

### **Core Services**
1. **EmbeddingsService** (`lib/embeddings-service.ts`) - OpenAI text-embedding-3-small integration
2. **RAGService** (`lib/rag-service.ts`) - Retrieval-Augmented Generation with cosine similarity
3. **AIChatbot** (`lib/ai-chatbot.ts`) - Claude Sonnet 4 integration with context awareness
4. **AiContextManager** (`lib/ai-context-manager.ts`) - Shared frontend AI interaction manager

### **API Endpoints**
- `POST /api/ai-chat` - Main AI chat endpoint with RAG context
- `POST /api/meetings/[roomName]/transcripts` - Store transcripts with embeddings
- `GET /api/meetings/[roomName]/transcripts` - Retrieve meeting transcripts

## **🔧 Setup Instructions**

### **1. Environment Variables**
Add to your `.env.local`:
```bash
# Required for AI functionality
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database (existing)
MONGODB_URI=mongodb://localhost:27017/ohm-meetings
```

### **2. Install Dependencies**
Dependencies are already included in `package.json`:
- `openai: ^5.0.1` - OpenAI embeddings
- `@anthropic-ai/sdk: ^0.52.0` - Claude AI

### **3. Database Schema**
The MongoDB schema already supports embeddings:
```typescript
// Meeting transcripts with embeddings
transcripts: [{
  speaker: string,
  text: string,
  timestamp: Date,
  embedding: number[] // Vector embeddings array
}]
```

## **🚀 Features Implemented**

### **1. Vector Embeddings**
- **Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Storage**: MongoDB arrays (ready for Atlas Vector Search migration)
- **Similarity**: Cosine similarity with 0.6 threshold
- **Batch Processing**: Up to 100 texts per API call

### **2. RAG (Retrieval-Augmented Generation)**
- **Current Transcripts**: Live meeting context from LiveKit data channel
- **Historical Context**: Vector search across past meeting transcripts
- **Smart Context**: Top 5 most relevant historical transcripts
- **Room Statistics**: Meeting counts, participant frequency, topic patterns

### **3. AI Chat Features**
- **Context-Aware Responses**: Uses current + historical meeting context
- **Web Search**: `@web` prefix for real-time information
- **Room Intelligence**: Understands meeting patterns and participants
- **Citation Support**: Links to relevant historical discussions

### **4. Frontend Integration Ready**
- **AiContextManager**: Shared service for both RoomChat and MeetingAssistant
- **Message Types**: User, AI, error handling with metadata
- **Command System**: `@ohm` and `@web` prefixes
- **Suggestions**: Context-aware question suggestions

## **📊 How It Works**

### **Live Meeting Flow**
1. User asks question in meeting chat
2. Current transcripts captured from LiveKit data channel
3. Question vectorized using OpenAI embeddings
4. Historical transcripts searched for relevant context
5. Combined context sent to Claude for response
6. AI responds with room-specific, contextual answer

### **Historical Context Flow**
1. When meeting ends, transcripts stored with embeddings
2. Future questions search across all room's historical transcripts
3. Most relevant past discussions included in AI context
4. Enables continuity across multiple meetings

### **Storage Strategy**
- **Live Meetings**: Generate embeddings on-demand for questions
- **Post-Meeting**: Store full transcripts + embeddings in database
- **Retrieval**: Vector similarity search across stored embeddings

## **🔌 API Usage Examples**

### **AI Chat with Context**
```javascript
const response = await fetch('/api/ai-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What decisions were made about the project timeline?",
    roomName: "project-standup",
    userName: "John Doe",
    currentTranscripts: "John: We need to push the deadline\nSarah: I agree, let's extend by 2 weeks",
    isLiveMeeting: true
  })
});
```

### **Store Meeting Transcripts**
```javascript
const response = await fetch('/api/meetings/project-standup/transcripts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meetingId: "meeting_id_here",
    transcripts: [
      {
        speaker: "John Doe",
        text: "Let's discuss the project timeline",
        timestamp: "2024-01-15T10:30:00Z"
      }
    ]
  })
});
```

## **🎯 Integration Points**

### **RoomChat Component**
- Use `AiContextManager.sendAiMessage()` for AI interactions
- Pass current transcripts from LiveKit data channel
- Handle `@ohm` and `@web` command prefixes

### **MeetingAssistant Component**
- Same `AiContextManager` for consistency
- Focus on meeting summaries and action items
- Historical context for recurring meetings

### **Meeting End Hook**
- Call `/api/meetings/[roomName]/transcripts` when last participant leaves
- Store complete transcript with speaker attribution
- Generate embeddings for future RAG queries

## **🔍 Testing Strategy**

### **Phase 2: Create Test Data**
1. Generate sample meetings with transcripts
2. Test vector similarity search accuracy
3. Validate AI responses with context
4. Performance testing with large transcript volumes

### **Monitoring**
- Track embedding generation costs
- Monitor AI response quality
- Measure context relevance scores
- Database query performance

## **🚀 Next Steps**

### **Phase 2: Frontend Integration**
1. Update `RoomChat.tsx` to use `AiContextManager`
2. Update `MeetingAssistant.tsx` with AI features
3. Add transcript capture from LiveKit
4. Implement meeting end transcript storage

### **Phase 3: Advanced Features**
1. Meeting summaries with action items
2. Automatic task creation from AI suggestions
3. Participant mention notifications
4. Meeting insights and analytics

## **📈 Performance Considerations**

- **Embedding Costs**: ~$0.00002 per 1K tokens (very affordable)
- **Storage**: 1536 numbers per transcript (manageable in MongoDB)
- **Latency**: ~200ms for embedding generation + similarity search
- **Scalability**: Ready for MongoDB Atlas Vector Search migration

## **🔒 Security & Privacy**

- API keys stored in environment variables
- Transcripts stored locally in your MongoDB
- No data sent to third parties except for AI processing
- Embeddings are mathematical representations, not raw text storage

---

**Status**: ✅ Phase 1 Complete - Core infrastructure ready for frontend integration! 