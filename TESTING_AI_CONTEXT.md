# Testing AI Assistant Cross-Meeting Context

This guide explains how to test the AI assistant's ability to store and retrieve context across different meetings.

## Overview

The AI assistant uses vector embeddings to store meeting transcripts and retrieve relevant historical context when answering questions. This allows it to reference previous meetings when providing responses.

## How It Works

1. **Transcript Storage**: Meeting transcripts are automatically stored every 30 seconds during active meetings
2. **Vector Embeddings**: Each transcript is converted to a vector embedding using OpenAI's `text-embedding-3-small` model
3. **Similarity Search**: When a user asks a question, the system searches for similar historical transcripts using cosine similarity
4. **Context Injection**: Relevant historical transcripts are provided to the AI alongside current meeting context

## Testing Methods

### Method 1: Automated Testing Script

Run the automated test script to populate test data and verify functionality:

```bash
# Make sure your development server is running
npm run dev

# In another terminal, run the test script
node test-ai-context.js
```

This script will:
- Store sample meeting transcripts with realistic scenarios
- Test vector similarity search
- Verify context retrieval
- Test actual AI responses with cross-meeting context

### Method 2: Manual Testing with Debug API

#### 1. Store Test Transcripts

```bash
# Store a sample transcript
curl -X POST http://localhost:3000/api/ai-debug \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "project-planning-1",
    "content": "John: We decided to allocate $100k budget for Q4. Sarah: Great, lets split it 60% development, 40% marketing.",
    "participants": ["John", "Sarah"],
    "customTimestamp": 1703001600000
  }'
```

#### 2. List All Stored Transcripts

```bash
curl http://localhost:3000/api/ai-debug?action=list-transcripts
```

#### 3. Test Similarity Search

```bash
curl "http://localhost:3000/api/ai-debug?action=search-similar&roomName=project-planning-2&query=budget%20allocation"
```

#### 4. Test Context Retrieval

```bash
curl "http://localhost:3000/api/ai-debug?action=test-context&roomName=project-planning-2&query=What%20was%20our%20budget%20decision"
```

### Method 3: Manual Testing in UI

#### Setup Test Scenario

1. **First Meeting** (Room: `project-alpha-1`):
   - Join the meeting
   - Let transcription run for a bit (or manually speak): "We need to allocate the Q4 budget. I suggest 60% for development and 40% for marketing. The total budget is $500k."
   - Wait for auto-storage (30 seconds) or use the debug API to store

2. **Second Meeting** (Room: `project-alpha-2`):
   - Join a different room name
   - Ask the AI: `@ohm What was our budget allocation decision from the previous meeting?`
   - The AI should reference the previous meeting's context

#### Test Queries

Try these queries in the second meeting to test cross-meeting context:

```
@ohm What was our budget allocation decision?
@ohm How much total budget do we have?
@ohm What percentage was allocated to development?
@ohm Who was in the previous budget discussion?
@ohm Summarize our previous budget meeting
```

## Expected Behavior

### Successful Context Retrieval

When working correctly, you should see:

1. **AI Response Indicators**:
   - `usedContext: true` in API responses
   - `relevantTranscripts > 0` showing number of historical references
   - Context badge in UI showing "X refs" 

2. **AI Response Content**:
   - References to "previous meetings"
   - Specific details from historical transcripts
   - Mentions of participants from other meetings
   - Date/time context ("In your meeting from X days ago...")

### Example Good Response

```
"Based on your previous meeting, you decided on a 60-40 split for the $500k Q4 budget. 
This allocates $300k (60%) to development and $200k (40%) to marketing. 
John and Sarah were part of that budget discussion."
```

## Debugging Issues

### Common Problems

1. **No Historical Context Found**
   - Check if transcripts are being stored: `/api/ai-debug?action=list-transcripts`
   - Verify OpenAI API key is configured
   - Check vector similarity threshold (may need related room names)

2. **Low Similarity Scores**
   - Room names should be related (e.g., `project-alpha-1`, `project-alpha-2`)
   - Query should semantically match stored content
   - Try more specific queries

3. **Storage Issues**
   - Check console logs for embedding generation errors
   - Verify transcript content is not empty
   - Check if 30-second auto-storage is working

### Debug Logs

Enable detailed logging by checking the browser console and server logs:

```javascript
// In browser console, check for:
console.log('Storing transcript for AI:', transcriptText);

// In server logs, look for:
"Stored transcript for room project-alpha-1"
"Error generating embedding: ..."
```

## Test Scenarios

### Scenario 1: Budget Planning Across Multiple Meetings

1. **Meeting 1**: Discuss initial budget ($500k total)
2. **Meeting 2**: Finalize allocation (60% dev, 40% marketing)  
3. **Meeting 3**: Ask about previous decisions
4. **Expected**: AI references both previous meetings

### Scenario 2: Cross-Team Context

1. **Dev Team Meeting**: Discuss technical requirements
2. **Marketing Meeting**: Plan campaign strategy
3. **All-Hands Meeting**: Ask AI to summarize insights from both teams
4. **Expected**: AI pulls context from both team meetings

### Scenario 3: Long-term Project Context

1. **Weekly Meetings**: Store context over multiple weeks
2. **Monthly Review**: Ask AI for project history
3. **Expected**: AI provides timeline of decisions and progress

## Performance Considerations

- Vector embeddings are generated in real-time (may take 1-2 seconds)
- Memory limit: 100 transcripts per room
- Automatic cleanup: 30-day retention by default
- Similarity search limited to 5 most relevant transcripts

## Troubleshooting

If tests fail, check:

1. **Environment Variables**:
   ```env
   OPENAI_API_KEY=sk-...
   ```

2. **Network Connectivity**:
   - OpenAI API access
   - No firewall blocking requests

3. **Rate Limits**:
   - OpenAI API rate limits
   - Too many concurrent requests

4. **Memory Issues**:
   - Server restart clears in-memory storage
   - Consider persistent storage for production

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai-debug` | GET | List transcripts, search, test context |
| `/api/ai-debug` | POST | Store test transcripts |
| `/api/ai-chat` | POST | Chat with AI (includes context) |
| `/api/ai-chat` | PUT | Store meeting transcript |

## Next Steps

After verifying the cross-meeting context works:

1. **Production Considerations**:
   - Implement persistent storage (database)
   - Add user authentication and data isolation
   - Configure proper rate limiting

2. **Enhanced Features**:
   - Meeting categorization and tagging
   - Advanced search filters
   - Context relevance scoring

3. **Performance Optimization**:
   - Caching for embeddings
   - Background processing for storage
   - Efficient vector similarity algorithms 