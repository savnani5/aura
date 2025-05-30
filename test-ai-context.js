#!/usr/bin/env node

// Test script for AI Assistant Cross-Meeting Context
// Run with: node test-ai-context.js

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Sample meeting data for testing
const testMeetings = [
  {
    roomName: 'project-alpha-meeting-1',
    participants: ['John', 'Sarah', 'Mike'],
    content: 'John: We need to discuss the Q4 budget allocation for project Alpha. Sarah: I think we should allocate 60% to development and 40% to marketing. Mike: That sounds reasonable, but we need to consider the infrastructure costs too. John: Good point, let me check with the finance team about the total budget.',
    customTimestamp: Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
  },
  {
    roomName: 'project-alpha-meeting-2',
    participants: ['John', 'Sarah', 'Lisa'],
    content: 'Sarah: Following up on our previous discussion about the budget. John: Finance approved $500k total budget for Q4. Lisa: Great! So that means $300k for development and $200k for marketing based on our 60-40 split. Sarah: We also need to factor in the infrastructure costs Mike mentioned.',
    customTimestamp: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    roomName: 'marketing-sync-1',
    participants: ['Sarah', 'Lisa', 'Tom'],
    content: 'Sarah: We have $200k allocated for marketing in Q4 for project Alpha. Lisa: I suggest we split this between digital advertising and content creation. Tom: We should also consider influencer partnerships. Lisa: Good idea, lets allocate 50% to digital ads, 30% to content, and 20% to influencers.',
    customTimestamp: Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    roomName: 'project-alpha-meeting-3',
    participants: ['John', 'Sarah', 'Mike', 'Lisa'],
    content: 'John: Current status update on project Alpha development. Mike: We are on track with the development timeline using our $300k budget. Sarah: Marketing team has finalized the strategy with the $200k allocation. Lisa: We decided on 50% digital ads, 30% content creation, and 20% influencer partnerships.',
    customTimestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
  }
];

// Test queries to validate cross-meeting context
const testQueries = [
  {
    roomName: 'project-alpha-meeting-4',
    query: 'What was our Q4 budget allocation decision?',
    expectedContext: 'Should find information about 60-40 split and $500k total budget'
  },
  {
    roomName: 'project-alpha-meeting-4',
    query: 'How did we decide to split the marketing budget?',
    expectedContext: 'Should find marketing budget breakdown: 50% digital, 30% content, 20% influencers'
  },
  {
    roomName: 'marketing-sync-2',
    query: 'What budget do we have for influencer partnerships?',
    expectedContext: 'Should find 20% of $200k = $40k for influencers'
  },
  {
    roomName: 'project-alpha-standup',
    query: 'Who was involved in the budget discussions?',
    expectedContext: 'Should find John, Sarah, Mike, Lisa, Tom across different meetings'
  }
];

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error making request to ${url}:`, error.message);
    return { status: 500, data: { error: error.message } };
  }
}

async function storeTestTranscripts() {
  console.log('📝 Storing test meeting transcripts...\n');
  
  for (const meeting of testMeetings) {
    console.log(`Storing: ${meeting.roomName}`);
    const result = await makeRequest('/api/ai-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meeting)
    });
    
    if (result.status === 200) {
      console.log(`✅ Success: ${meeting.roomName}`);
    } else {
      console.log(`❌ Failed: ${meeting.roomName} - ${result.data.error}`);
    }
  }
  console.log('\n');
}

async function listStoredTranscripts() {
  console.log('📋 Listing all stored transcripts...\n');
  
  const result = await makeRequest('/api/ai-debug?action=list-transcripts');
  
  if (result.status === 200) {
    const { transcripts, totalRooms, totalTranscripts } = result.data;
    console.log(`Total rooms: ${totalRooms}, Total transcripts: ${totalTranscripts}\n`);
    
    for (const [roomName, roomTranscripts] of Object.entries(transcripts)) {
      console.log(`Room: ${roomName} (${roomTranscripts.length} transcripts)`);
      roomTranscripts.forEach(t => {
        console.log(`  - ${t.id} | ${t.timestamp} | ${t.participants.join(', ')}`);
        console.log(`    ${t.content}`);
      });
      console.log('');
    }
  } else {
    console.log(`❌ Failed to list transcripts: ${result.data.error}`);
  }
}

async function testContextRetrieval() {
  console.log('🔍 Testing cross-meeting context retrieval...\n');
  
  for (const test of testQueries) {
    console.log(`Query: "${test.query}"`);
    console.log(`Room: ${test.roomName}`);
    console.log(`Expected: ${test.expectedContext}\n`);
    
    const result = await makeRequest(
      `/api/ai-debug?action=test-context&roomName=${encodeURIComponent(test.roomName)}&query=${encodeURIComponent(test.query)}`
    );
    
    if (result.status === 200) {
      const { context } = result.data;
      console.log(`✅ Found ${context.relevantHistory.length} relevant historical transcripts:`);
      
      context.relevantHistory.forEach((transcript, index) => {
        console.log(`  ${index + 1}. ${transcript.roomName} (${transcript.timestamp})`);
        console.log(`     Participants: ${transcript.participants.join(', ')}`);
        console.log(`     Content: ${transcript.content.substring(0, 150)}...`);
      });
      
      if (context.relevantHistory.length === 0) {
        console.log('⚠️  No relevant historical context found');
      }
    } else {
      console.log(`❌ Failed to test context: ${result.data.error}`);
    }
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

async function testSimilaritySearch() {
  console.log('🔎 Testing similarity search functionality...\n');
  
  const searchTests = [
    { roomName: 'project-alpha-meeting-4', query: 'budget allocation', expected: 'budget-related meetings' },
    { roomName: 'marketing-sync-2', query: 'digital advertising', expected: 'marketing strategy discussions' },
    { roomName: 'any-room', query: 'infrastructure costs', expected: 'meetings mentioning infrastructure' }
  ];
  
  for (const test of searchTests) {
    console.log(`Searching for: "${test.query}" in context of room: ${test.roomName}`);
    
    const result = await makeRequest(
      `/api/ai-debug?action=search-similar&roomName=${encodeURIComponent(test.roomName)}&query=${encodeURIComponent(test.query)}`
    );
    
    if (result.status === 200) {
      const { relevantTranscripts } = result.data;
      console.log(`Found ${relevantTranscripts.length} similar transcripts:`);
      
      relevantTranscripts.forEach((transcript, index) => {
        console.log(`  ${index + 1}. ${transcript.roomName} | ${transcript.timestamp}`);
        // Highlight query terms in content
        const content = transcript.content.toLowerCase().includes(test.query.toLowerCase()) 
          ? `🎯 ${transcript.content}` 
          : transcript.content;
        console.log(`     ${content.substring(0, 200)}...`);
      });
    } else {
      console.log(`❌ Search failed: ${result.data.error}`);
    }
    console.log('\n');
  }
}

async function testAIResponse() {
  console.log('🤖 Testing actual AI responses with cross-meeting context...\n');
  
  for (const test of testQueries.slice(0, 2)) { // Test first 2 queries
    console.log(`Testing AI response for: "${test.query}"`);
    console.log(`Room: ${test.roomName}\n`);
    
    const result = await makeRequest('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: test.query,
        roomName: test.roomName,
        userName: 'TestUser',
        currentTranscripts: 'TestUser: ' + test.query
      })
    });
    
    if (result.status === 200) {
      const { response, usedContext, relevantTranscripts } = result.data;
      console.log(`✅ AI Response (used context: ${usedContext}, relevant transcripts: ${relevantTranscripts}):`);
      console.log(`"${response}"`);
      
      if (usedContext) {
        console.log(`🎯 Successfully used cross-meeting context!`);
      } else {
        console.log(`⚠️  AI didn't use historical context`);
      }
    } else {
      console.log(`❌ AI request failed: ${result.data.error}`);
    }
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

async function runTests() {
  console.log('🚀 Starting AI Assistant Cross-Meeting Context Tests\n');
  console.log('=' * 60 + '\n');
  
  try {
    // Step 1: Store test data
    await storeTestTranscripts();
    
    // Step 2: Verify storage
    await listStoredTranscripts();
    
    // Step 3: Test context retrieval
    await testContextRetrieval();
    
    // Step 4: Test similarity search
    await testSimilaritySearch();
    
    // Step 5: Test actual AI responses
    await testAIResponse();
    
    console.log('✅ All tests completed!');
    console.log('\nTo test manually:');
    console.log('1. Join a meeting room (e.g., "project-alpha-meeting-4")');
    console.log('2. Try these AI commands:');
    console.log('   - @ohm What was our Q4 budget allocation decision?');
    console.log('   - @ohm How did we split the marketing budget?');
    console.log('   - @ohm Who was involved in budget discussions?');
    console.log('\nDebug endpoints:');
    console.log(`- ${API_BASE}/api/ai-debug?action=list-transcripts`);
    console.log(`- ${API_BASE}/api/ai-debug?action=search-similar&roomName=PROJECT&query=SEARCH_TERM`);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Check if we have fetch available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with native fetch support');
  console.log('Install node-fetch as alternative: npm install node-fetch');
  process.exit(1);
}

// Run the tests
runTests().catch(console.error); 