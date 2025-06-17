#!/usr/bin/env node

/**
 * Simple test script for AI Infrastructure (Phase 1)
 * Tests all core services without fancy UI
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`🧪 ${title}`, 'bold');
  console.log('='.repeat(60));
}

function logTest(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`${icon} ${testName}`, color);
  if (details) {
    log(`   ${details}`, 'blue');
  }
}

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testEnvironmentSetup() {
  logSection('Environment Setup Tests');
  
  // Check required environment variables
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'MONGODB_URI'
  ];
  
  let allEnvVarsPresent = true;
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      logTest(`${envVar} configured`, 'PASS');
    } else {
      logTest(`${envVar} missing`, 'FAIL', 'Add to .env.local');
      allEnvVarsPresent = false;
    }
  }
  
  return allEnvVarsPresent;
}

async function testDatabaseConnection() {
  logSection('Database Connection Tests');
  
  try {
    // Test if we can import and connect to database
    const { DatabaseService } = await import('./lib/mongodb.ts');
    const db = DatabaseService.getInstance();
    
    logTest('Database service import', 'PASS');
    
    // Try to connect
    await db.ensureConnection();
    logTest('MongoDB connection', 'PASS');
    
    return true;
  } catch (error) {
    logTest('Database connection', 'FAIL', error.message);
    return false;
  }
}

async function testEmbeddingsService() {
  logSection('Embeddings Service Tests');
  
  try {
    const { EmbeddingsService } = await import('./lib/embeddings-service.ts');
    const embeddingsService = EmbeddingsService.getInstance();
    
    logTest('Embeddings service import', 'PASS');
    
    // Test single embedding generation
    logTest('Single embedding generation', 'RUNNING', 'Testing with sample text...');
    const singleResult = await embeddingsService.generateEmbedding('Hello, this is a test message');
    
    if (singleResult.embedding && singleResult.embedding.length === 1536) {
      logTest('Single embedding generation', 'PASS', `Generated ${singleResult.embedding.length}D vector`);
    } else {
      logTest('Single embedding generation', 'FAIL', 'Invalid embedding dimensions');
      return false;
    }
    
    // Test batch embedding generation
    logTest('Batch embedding generation', 'RUNNING', 'Testing with multiple texts...');
    const batchTexts = [
      'John: Let\'s discuss the project timeline',
      'Sarah: I think we need more time for testing',
      'Mike: What about the deployment schedule?'
    ];
    
    const batchResults = await embeddingsService.generateEmbeddings(batchTexts);
    
    if (batchResults.length === 3 && batchResults.every(r => r.embedding.length === 1536)) {
      logTest('Batch embedding generation', 'PASS', `Generated ${batchResults.length} embeddings`);
    } else {
      logTest('Batch embedding generation', 'FAIL', 'Invalid batch results');
      return false;
    }
    
    // Test cosine similarity
    const similarity = embeddingsService.calculateCosineSimilarity(
      singleResult.embedding,
      batchResults[0].embedding
    );
    
    if (similarity >= 0 && similarity <= 1) {
      logTest('Cosine similarity calculation', 'PASS', `Similarity: ${similarity.toFixed(4)}`);
    } else {
      logTest('Cosine similarity calculation', 'FAIL', 'Invalid similarity score');
      return false;
    }
    
    return true;
  } catch (error) {
    logTest('Embeddings service test', 'FAIL', error.message);
    return false;
  }
}

async function testRAGService() {
  logSection('RAG Service Tests');
  
  try {
    const { RAGService } = await import('./lib/rag-service.ts');
    const ragService = RAGService.getInstance();
    
    logTest('RAG service import', 'PASS');
    
    // Test context generation for non-existent room (should handle gracefully)
    logTest('Context for non-existent room', 'RUNNING', 'Testing error handling...');
    const context = await ragService.getContextForQuery(
      'non-existent-room',
      'What was discussed in our last meeting?'
    );
    
    if (context && !context.usedContext && context.totalRelevantTranscripts === 0) {
      logTest('Context for non-existent room', 'PASS', 'Handled gracefully');
    } else {
      logTest('Context for non-existent room', 'FAIL', 'Did not handle gracefully');
      return false;
    }
    
    // Test current transcript processing
    logTest('Current transcript processing', 'RUNNING', 'Testing transcript parsing...');
    const currentTranscripts = `John: Hello everyone, let's start the meeting
Sarah: Great, I have the agenda ready
Mike: Should we discuss the project timeline first?`;
    
    const contextWithCurrent = await ragService.getContextForQuery(
      'test-room',
      'What are we discussing?',
      currentTranscripts,
      true
    );
    
    if (contextWithCurrent.currentTranscripts.length === 3) {
      logTest('Current transcript processing', 'PASS', `Parsed ${contextWithCurrent.currentTranscripts.length} transcripts`);
    } else {
      logTest('Current transcript processing', 'FAIL', 'Failed to parse transcripts');
      return false;
    }
    
    // Test room stats for non-existent room
    const roomStats = await ragService.getRoomStats('non-existent-room');
    if (roomStats.totalMeetings === 0) {
      logTest('Room stats for non-existent room', 'PASS', 'Returned empty stats');
    } else {
      logTest('Room stats for non-existent room', 'FAIL', 'Did not return empty stats');
      return false;
    }
    
    return true;
  } catch (error) {
    logTest('RAG service test', 'FAIL', error.message);
    return false;
  }
}

async function testAIChatbot() {
  logSection('AI Chatbot Tests');
  
  try {
    const { AIChatbot } = await import('./lib/ai-chatbot.ts');
    const chatbot = AIChatbot.getInstance();
    
    logTest('AI chatbot import', 'PASS');
    
    // Test basic chat without context
    logTest('Basic AI chat', 'RUNNING', 'Testing simple question...');
    const response = await chatbot.processChat(
      'Hello, can you help me with meeting management?',
      'test-room',
      'Test User'
    );
    
    if (response.message && response.message.length > 0) {
      logTest('Basic AI chat', 'PASS', `Response: "${response.message.substring(0, 50)}..."`);
    } else {
      logTest('Basic AI chat', 'FAIL', 'No response received');
      return false;
    }
    
    // Test chat with current transcripts
    logTest('AI chat with context', 'RUNNING', 'Testing with meeting context...');
    const contextResponse = await chatbot.processChat(
      'What are the main topics being discussed?',
      'test-room',
      'Test User',
      'John: We need to finalize the project timeline\nSarah: The testing phase needs more time',
      true
    );
    
    if (contextResponse.message && contextResponse.usedContext) {
      logTest('AI chat with context', 'PASS', `Used context: ${contextResponse.usedContext}`);
    } else {
      logTest('AI chat with context', 'FAIL', 'Context not used properly');
      return false;
    }
    
    // Test web search detection
    logTest('Web search detection', 'RUNNING', 'Testing @web command...');
    const webResponse = await chatbot.processChat(
      '@web latest AI developments in 2024',
      'test-room',
      'Test User'
    );
    
    if (webResponse.message) {
      logTest('Web search detection', 'PASS', 'Web search processed');
    } else {
      logTest('Web search detection', 'FAIL', 'Web search failed');
      return false;
    }
    
    return true;
  } catch (error) {
    logTest('AI chatbot test', 'FAIL', error.message);
    return false;
  }
}

async function testAiContextManager() {
  logSection('AI Context Manager Tests');
  
  try {
    const { AiContextManager } = await import('./lib/ai-context-manager.ts');
    const contextManager = AiContextManager.getInstance();
    
    logTest('AI context manager import', 'PASS');
    
    // Test message creation
    const userMessage = contextManager.createUserMessage('Test message', 'Test User');
    if (userMessage.type === 'user' && userMessage.message === 'Test message') {
      logTest('User message creation', 'PASS');
    } else {
      logTest('User message creation', 'FAIL');
      return false;
    }
    
    // Test AI command detection
    const isCommand1 = contextManager.isAiCommand('@ohm help me');
    const isCommand2 = contextManager.isAiCommand('@web search something');
    const isNotCommand = contextManager.isAiCommand('regular message');
    
    if (isCommand1 && isCommand2 && !isNotCommand) {
      logTest('AI command detection', 'PASS');
    } else {
      logTest('AI command detection', 'FAIL');
      return false;
    }
    
    // Test question suggestions
    const suggestions = contextManager.getQuestionSuggestions(true);
    if (suggestions.length > 0) {
      logTest('Question suggestions', 'PASS', `Generated ${suggestions.length} suggestions`);
    } else {
      logTest('Question suggestions', 'FAIL');
      return false;
    }
    
    return true;
  } catch (error) {
    logTest('AI context manager test', 'FAIL', error.message);
    return false;
  }
}

async function startNextJsServer() {
  return new Promise((resolve) => {
    log('\n🚀 Starting Next.js development server...', 'yellow');
    
    const server = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let serverReady = false;
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('started server on')) {
        if (!serverReady) {
          serverReady = true;
          log('✅ Next.js server is ready!', 'green');
          resolve(server);
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('started server on')) {
        if (!serverReady) {
          serverReady = true;
          log('✅ Next.js server is ready!', 'green');
          resolve(server);
        }
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        log('⚠️  Server startup timeout, proceeding anyway...', 'yellow');
        resolve(server);
      }
    }, 30000);
  });
}

async function testAPIEndpoints() {
  logSection('API Endpoints Tests');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test AI chat endpoint
  logTest('AI chat endpoint', 'RUNNING', 'Testing POST /api/ai-chat...');
  const aiChatResult = await makeRequest(`${baseUrl}/api/ai-chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Hello, this is a test message',
      roomName: 'test-room',
      userName: 'Test User'
    })
  });
  
  if (aiChatResult.success && aiChatResult.data.success) {
    logTest('AI chat endpoint', 'PASS', 'API responded successfully');
  } else {
    logTest('AI chat endpoint', 'FAIL', aiChatResult.error || 'API error');
    return false;
  }
  
  // Test transcript storage endpoint (should fail gracefully with non-existent meeting)
  logTest('Transcript storage endpoint', 'RUNNING', 'Testing POST /api/meetings/test-room/transcripts...');
  const transcriptResult = await makeRequest(`${baseUrl}/api/meetings/test-room/transcripts`, {
    method: 'POST',
    body: JSON.stringify({
      meetingId: 'non-existent-meeting-id',
      transcripts: [
        {
          speaker: 'Test User',
          text: 'This is a test transcript',
          timestamp: new Date().toISOString()
        }
      ]
    })
  });
  
  if (!transcriptResult.success && transcriptResult.status === 404) {
    logTest('Transcript storage endpoint', 'PASS', 'Correctly handled non-existent meeting');
  } else {
    logTest('Transcript storage endpoint', 'FAIL', 'Did not handle error correctly');
    return false;
  }
  
  return true;
}

async function runAllTests() {
  log('🧪 AI Infrastructure Test Suite', 'bold');
  log('Testing Phase 1 implementation...', 'blue');
  
  const results = {
    environment: false,
    database: false,
    embeddings: false,
    rag: false,
    chatbot: false,
    contextManager: false,
    apiEndpoints: false
  };
  
  // Test 1: Environment Setup
  results.environment = await testEnvironmentSetup();
  
  if (!results.environment) {
    log('\n❌ Environment setup failed. Please configure required API keys.', 'red');
    process.exit(1);
  }
  
  // Test 2: Database Connection
  results.database = await testDatabaseConnection();
  
  // Test 3: Embeddings Service
  results.embeddings = await testEmbeddingsService();
  
  // Test 4: RAG Service
  results.rag = await testRAGService();
  
  // Test 5: AI Chatbot
  results.chatbot = await testAIChatbot();
  
  // Test 6: AI Context Manager
  results.contextManager = await testAiContextManager();
  
  // Test 7: API Endpoints (requires server)
  log('\n🚀 Starting server for API tests...', 'yellow');
  const server = await startNextJsServer();
  
  // Wait a bit for server to be fully ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  results.apiEndpoints = await testAPIEndpoints();
  
  // Clean up server
  if (server) {
    server.kill();
    log('🛑 Server stopped', 'yellow');
  }
  
  // Final Results
  logSection('Test Results Summary');
  
  const testNames = {
    environment: 'Environment Setup',
    database: 'Database Connection',
    embeddings: 'Embeddings Service',
    rag: 'RAG Service',
    chatbot: 'AI Chatbot',
    contextManager: 'AI Context Manager',
    apiEndpoints: 'API Endpoints'
  };
  
  let passedTests = 0;
  let totalTests = Object.keys(results).length;
  
  for (const [key, passed] of Object.entries(results)) {
    const testName = testNames[key];
    if (passed) {
      logTest(testName, 'PASS');
      passedTests++;
    } else {
      logTest(testName, 'FAIL');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (passedTests === totalTests) {
    log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`, 'green');
    log('✅ Phase 1 AI Infrastructure is ready for Phase 2!', 'green');
  } else {
    log(`⚠️  ${passedTests}/${totalTests} tests passed`, 'yellow');
    log('❌ Some components need attention before Phase 2', 'red');
  }
  console.log('='.repeat(60));
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
}); 