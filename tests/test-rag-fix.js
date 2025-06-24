const API_BASE = 'http://localhost:3000';

// Test the RAG service transcript retrieval with the new schema
const testRAGRetrieval = async () => {
  console.log('🧪 Testing RAG Transcript Retrieval with New Schema');
  console.log('=' * 60);

  try {
    // Step 1: Test AI chat in your test room
    console.log('\n📋 Step 1: Testing AI Chat in test room...');
    
    const testQueries = [
      'What was discussed in previous meetings?',
      'Can you summarize our past discussions?', 
      'What is my favorite food?',
      'Tell me about the transcript testing'
    ];

    for (const query of testQueries) {
      console.log(`\n🤖 Testing query: "${query}"`);
      
      try {
        const chatResponse = await fetch(`${API_BASE}/api/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: query,
            roomName: 'test-room-mc8tevbe', // Your test room
            userName: 'Test User',
            isLiveMeeting: false
          })
        });

        const chatData = await chatResponse.json();
        
        if (chatData.success) {
          console.log(`   ✅ Response received (${chatData.data.message.length} chars)`);
          console.log(`   📊 Used context: ${chatData.data.usedContext}`);
          console.log(`   📝 Relevant transcripts: ${chatData.data.relevantTranscripts || 0}`);
          console.log(`   🌐 Used web search: ${chatData.data.usedWebSearch || false}`);
          console.log(`   💬 Response preview: ${chatData.data.message.substring(0, 200)}...`);
        } else {
          console.log(`   ❌ Chat failed: ${chatData.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Request error: ${error.message}`);
      }
    }

    // Step 2: Test direct RAG service 
    console.log('\n📋 Step 2: Testing database embedding query...');
    
    try {
      const embeddingTestResponse = await fetch(`${API_BASE}/api/admin/test-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: 'test-room-mc8tevbe',
          query: 'favorite food biryani'
        })
      });

      const embeddingData = await embeddingTestResponse.json();
      
      if (embeddingData.success) {
        console.log(`   ✅ Embedding test successful`);
        console.log(`   📊 Total meetings checked: ${embeddingData.totalMeetings || 0}`);
        console.log(`   📝 Total transcripts with embeddings: ${embeddingData.totalTranscriptsWithEmbeddings || 0}`);
        console.log(`   🎯 Top similarity scores: ${embeddingData.topSimilarities?.join(', ') || 'None'}`);
      } else {
        console.log(`   ❌ Embedding test failed: ${embeddingData.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Embedding test error: ${error.message}`);
    }

    // Step 3: Check room stats
    console.log('\n📋 Step 3: Checking room statistics...');
    
    try {
      const roomStatsResponse = await fetch(`${API_BASE}/api/meetings/test-room-mc8tevbe`, {
        method: 'GET'
      });

      const roomData = await roomStatsResponse.json();
      
      if (roomData.success) {
        console.log(`   ✅ Room found: ${roomData.data.title}`);
        console.log(`   📊 Room ID: ${roomData.data._id}`);
        console.log(`   👥 Participants: ${roomData.data.participants?.length || 0}`);
        console.log(`   📅 Last meeting: ${roomData.data.lastMeetingAt || 'Never'}`);
      } else {
        console.log(`   ❌ Room query failed: ${roomData.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Room stats error: ${error.message}`);
    }

    console.log('\n🏁 RAG Retrieval Test Complete!');
    console.log('\nIf you see "Used context: true" and "Relevant transcripts: > 0" above,');
    console.log('then the RAG transcript retrieval is working correctly! 🎉');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
};

// Create test endpoint for embeddings validation
const createEmbeddingTestEndpoint = `
// This should be added to app/api/admin/test-embeddings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { RAGService } from '@/lib/rag-service';

export async function POST(request: NextRequest) {
  try {
    const { roomName, query } = await request.json();
    
    const dbService = DatabaseService.getInstance();
    const ragService = RAGService.getInstance();
    
    console.log(\`🔍 Testing embeddings for room: \${roomName}, query: "\${query}"\`);
    
    // Get RAG context
    const ragContext = await ragService.getContextForQuery(roomName, query, undefined, false);
    
    // Get room data
    const room = await dbService.getMeetingRoomByName(roomName);
    const meetings = room ? await dbService.getMeetingsByRoomWithFilters({
      roomId: room._id,
      limit: 10
    }) : [];
    
    const totalTranscriptsWithEmbeddings = ragContext.historicalContext.length;
    const topSimilarities = ragContext.historicalContext
      .slice(0, 5)
      .map(ctx => ctx.similarity?.toFixed(3))
      .filter(Boolean);
    
    return NextResponse.json({
      success: true,
      roomFound: !!room,
      totalMeetings: meetings.length,
      totalTranscriptsWithEmbeddings,
      ragContextUsed: ragContext.usedContext,
      topSimilarities,
      sampleContexts: ragContext.historicalContext.slice(0, 3).map(ctx => ({
        speaker: ctx.speaker,
        text: ctx.text.substring(0, 100) + '...',
        similarity: ctx.similarity?.toFixed(3)
      }))
    });
    
  } catch (error) {
    console.error('Error in embedding test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
`;

console.log('Test endpoint code to add:');
console.log(createEmbeddingTestEndpoint);

// Run the test
testRAGRetrieval(); 