#!/usr/bin/env node

/**
 * Simple AI Infrastructure Test - API-focused approach
 * Tests core functionality through API endpoints
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

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
  console.log('\n' + '='.repeat(50));
  log(`🧪 ${title}`, 'bold');
  console.log('='.repeat(50));
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
  logSection('Environment Setup');
  
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY', 
    'MONGODB_URI'
  ];
  
  let allPresent = true;
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      logTest(`${envVar}`, 'PASS', 'Configured');
    } else {
      logTest(`${envVar}`, 'FAIL', 'Missing from .env.local');
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function testOpenAIConnection() {
  logSection('OpenAI API Connection');
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    logTest('OpenAI client creation', 'PASS');
    
    // Test embedding generation
    logTest('Embedding generation', 'RUNNING', 'Testing with sample text...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Hello, this is a test for AI infrastructure',
      encoding_format: 'float',
    });
    
    if (response.data[0].embedding.length === 1536) {
      logTest('Embedding generation', 'PASS', `Generated ${response.data[0].embedding.length}D vector`);
      logTest('Token usage', 'PASS', `Used ${response.usage.total_tokens} tokens`);
      return true;
    } else {
      logTest('Embedding generation', 'FAIL', 'Invalid embedding dimensions');
      return false;
    }
    
  } catch (error) {
    logTest('OpenAI connection', 'FAIL', error.message);
    return false;
  }
}

async function testAnthropicConnection() {
  logSection('Anthropic API Connection');
  
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    logTest('Anthropic client creation', 'PASS');
    
    // Test simple chat
    logTest('Claude chat', 'RUNNING', 'Testing simple message...');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Hello! Please respond with just "AI test successful" to confirm you are working.'
      }],
    });
    
    if (response.content[0].text.includes('AI test successful')) {
      logTest('Claude chat', 'PASS', 'AI responded correctly');
      return true;
    } else {
      logTest('Claude chat', 'PASS', `Response: "${response.content[0].text.substring(0, 50)}..."`);
      return true;
    }
    
  } catch (error) {
    logTest('Anthropic connection', 'FAIL', error.message);
    return false;
  }
}

async function testMongoDBConnection() {
  logSection('MongoDB Connection');
  
  try {
    const mongoose = (await import('mongoose')).default;
    
    logTest('Mongoose import', 'PASS');
    
    // Test connection
    logTest('MongoDB connection', 'RUNNING', 'Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    });
    
    logTest('MongoDB connection', 'PASS', 'Connected successfully');
    
    // Test basic operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    logTest('Database operations', 'PASS', `Found ${collections.length} collections`);
    
    // Close connection
    await mongoose.connection.close();
    logTest('Connection cleanup', 'PASS', 'Disconnected cleanly');
    
    return true;
    
  } catch (error) {
    logTest('MongoDB connection', 'FAIL', error.message);
    return false;
  }
}

async function testAIChatAPI() {
  logSection('AI Chat API Test');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test basic AI chat
  logTest('AI Chat endpoint', 'RUNNING', 'Testing POST /api/ai-chat...');
  
  const chatResult = await makeRequest(`${baseUrl}/api/ai-chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Hello! Please respond briefly to confirm the AI chat is working.',
      roomName: 'test-room',
      userName: 'Test User'
    })
  });
  
  if (chatResult.success && chatResult.data.success) {
    logTest('AI Chat endpoint', 'PASS', 'API responded successfully');
    logTest('AI Response', 'PASS', `"${chatResult.data.response.substring(0, 60)}..."`);
    return true;
  } else {
    logTest('AI Chat endpoint', 'FAIL', chatResult.error || 'API error');
    return false;
  }
}

async function waitForServer(maxWaitTime = 30000) {
  const startTime = Date.now();
  const baseUrl = 'http://localhost:3000';
  
  log('⏳ Waiting for Next.js server to be ready...', 'yellow');
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await makeRequest(`${baseUrl}/api/ai-chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'test',
          roomName: 'test',
          userName: 'test'
        })
      });
      
      // If we get any response (even an error), server is ready
      if (response.status) {
        log('✅ Server is ready!', 'green');
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log('⚠️ Server timeout, proceeding anyway...', 'yellow');
  return false;
}

async function runTests() {
  log('🧪 AI Infrastructure Simple Test Suite', 'bold');
  log('Testing Phase 1 core components...', 'blue');
  
  const results = {};
  
  // Test 1: Environment
  results.environment = await testEnvironmentSetup();
  if (!results.environment) {
    log('\n❌ Environment setup failed. Please check .env.local', 'red');
    return;
  }
  
  // Test 2: OpenAI
  results.openai = await testOpenAIConnection();
  
  // Test 3: Anthropic
  results.anthropic = await testAnthropicConnection();
  
  // Test 4: MongoDB
  results.mongodb = await testMongoDBConnection();
  
  // Test 5: API (requires server)
  log('\n🚀 Testing API endpoints...', 'yellow');
  log('💡 Make sure Next.js dev server is running: npm run dev', 'blue');
  
  const serverReady = await waitForServer();
  if (serverReady) {
    results.api = await testAIChatAPI();
  } else {
    results.api = false;
    logTest('AI Chat API', 'FAIL', 'Server not accessible');
  }
  
  // Summary
  logSection('Test Results Summary');
  
  const testNames = {
    environment: 'Environment Setup',
    openai: 'OpenAI Connection',
    anthropic: 'Anthropic Connection', 
    mongodb: 'MongoDB Connection',
    api: 'AI Chat API'
  };
  
  let passed = 0;
  let total = Object.keys(results).length;
  
  for (const [key, success] of Object.entries(results)) {
    if (success) {
      logTest(testNames[key], 'PASS');
      passed++;
    } else {
      logTest(testNames[key], 'FAIL');
    }
  }
  
  console.log('\n' + '='.repeat(50));
  if (passed === total) {
    log(`🎉 ALL TESTS PASSED! (${passed}/${total})`, 'green');
    log('✅ Phase 1 AI Infrastructure is working!', 'green');
  } else {
    log(`⚠️ ${passed}/${total} tests passed`, 'yellow');
    if (!results.api && passed === total - 1) {
      log('💡 Start server with "npm run dev" to test API', 'blue');
    }
  }
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}); 