/**
 * Clerk Webhook Verification Script
 * 
 * This script provides three key functions:
 * 1. Generate correctly signed webhook payloads for testing
 * 2. Verify webhook URL routes don't have redirect issues
 * 3. Send test webhooks to validate your implementation
 * 
 * Based on Clerk documentation: https://clerk.com/docs/webhooks/debug-your-webhooks
 */

require('dotenv').config();
const crypto = require('crypto');
const fetch = require('node-fetch');
const { Webhook } = require('svix');

// Get webhook secret from environment or prompt
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || 'whsec_test';

if (!WEBHOOK_SECRET) {
  console.error('⚠️ Warning: CLERK_WEBHOOK_SECRET not found in environment');
  console.error('Signature verification will not work properly without a valid secret');
}

// Sample webhook payloads for different event types
const samplePayloads = {
  userCreated: {
    type: 'user.created',
    data: {
      id: 'user_test_' + Date.now(),
      email_addresses: [{ email_address: 'test@example.com' }],
      first_name: 'Test',
      last_name: 'User',
      created_at: Date.now(),
      image_url: 'https://placekitten.com/200/200'
    },
    object: 'event',
    timestamp: Math.floor(Date.now() / 1000)
  },
  userUpdated: {
    type: 'user.updated',
    data: {
      id: 'user_test_' + Date.now(),
      email_addresses: [{ email_address: 'updated@example.com' }],
      first_name: 'Updated',
      last_name: 'User',
      created_at: Date.now() - 3600000, // 1 hour ago
      updated_at: Date.now(),
      image_url: 'https://placekitten.com/200/200'
    },
    object: 'event',
    timestamp: Math.floor(Date.now() / 1000)
  },
  userDeleted: {
    type: 'user.deleted',
    data: {
      id: 'user_test_' + Date.now(),
      deleted: true
    },
    object: 'event',
    timestamp: Math.floor(Date.now() / 1000)
  }
};

/**
 * Generate a valid webhook signature using Clerk's approach (via Svix)
 * 
 * @param {Object|string} payload - The webhook payload
 * @returns {Object} - Headers and body for the webhook request
 */
function generateSignature(payload) {
  // Convert to string if needed
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate a unique message ID
  const messageId = crypto.randomUUID();
  
  // Method 1: Manual signature creation
  // Create the signature using the Svix format
  const signaturePayload = `${timestamp}.${messageId}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(signaturePayload)
    .digest('base64');
  
  // Method 2: Using Svix library (more accurate to production)
  // Try to use Svix if available
  let svixSignature = `v1,${signature}`;
  try {
    if (typeof Webhook === 'function') {
      const wh = new Webhook(WEBHOOK_SECRET);
      const svixHeaders = wh.sign(payloadStr, {
        timestamp: timestamp,
        id: messageId,
      });
      svixSignature = svixHeaders['svix-signature'];
    }
  } catch (error) {
    console.warn('⚠️ Could not use Svix library for signature, using manual method instead');
  }
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'svix-id': messageId,
      'svix-timestamp': timestamp,
      'svix-signature': svixSignature
    },
    body: payloadStr
  };
}

/**
 * Verify the endpoints respond correctly to webhook requests
 * 
 * @param {string} url - The webhook URL to test
 * @param {Object} signedRequest - The signed request to send
 * @returns {Promise<Object>} - The test results
 */
async function testEndpoint(url, signedRequest) {
  try {
    // First make a HEAD request to check for redirects
    const headResponse = await fetch(url, { 
      method: 'HEAD',
      redirect: 'manual' 
    });
    
    const headStatus = headResponse.status;
    const isHeadRedirected = headStatus >= 300 && headStatus < 400;
    const headLocation = isHeadRedirected ? headResponse.headers.get('location') : null;
    
    // Then send the actual webhook request with proper signature
    const postResponse = await fetch(url, {
      method: 'POST',
      headers: signedRequest.headers,
      body: signedRequest.body,
      redirect: 'manual'
    });
    
    const postStatus = postResponse.status;
    const isPostRedirected = postStatus >= 300 && postStatus < 400;
    const postLocation = isPostRedirected ? postResponse.headers.get('location') : null;
    
    let responseBody = null;
    if (!isPostRedirected) {
      try {
        responseBody = await postResponse.text();
      } catch (error) {
        console.log(`Could not read response body: ${error.message}`);
      }
    }
    
    return {
      head: {
        status: headStatus,
        redirected: isHeadRedirected,
        location: headLocation
      },
      post: {
        status: postStatus,
        redirected: isPostRedirected,
        location: postLocation,
        body: responseBody
      }
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}

// Endpoints to test (add your own)
const endpoints = [
  // Test local development server
  {
    name: 'Local Development',
    url: 'http://localhost:3000/api/webhooks/clerk',
  },
  // Test production
  {
    name: 'Production',
    url: 'https://tryohm.com/api/webhooks/clerk',
  },
  // Test with trailing slash
  {
    name: 'Production with trailing slash',
    url: 'https://tryohm.com/api/webhooks/clerk/',
  }
];

/**
 * Run comprehensive webhook tests
 */
async function runTests() {
  console.log('🧪 Running Clerk Webhook Verification Tests\n');
  console.log('ℹ️ This script will:');
  console.log('  1. Check for redirect issues that break signature verification');
  console.log('  2. Test webhook delivery with proper signatures');
  console.log('  3. Verify different event types are handled correctly\n');
  
  console.log('🔑 Using webhook secret:', WEBHOOK_SECRET ? `${WEBHOOK_SECRET.substring(0, 5)}...` : 'None');
  
  for (const [eventName, payload] of Object.entries(samplePayloads)) {
    console.log(`\n📦 Testing event: ${eventName} (${payload.type})`);
    
    const signedRequest = generateSignature(payload);
    
    console.log(`  Generated signature: ${signedRequest.headers['svix-signature'].substring(0, 15)}...`);
    
    for (const endpoint of endpoints) {
      console.log(`\n🌐 Testing ${endpoint.name}: ${endpoint.url}`);
      
      const results = await testEndpoint(endpoint.url, signedRequest);
      
      if (results.error) {
        console.error(`  ❌ Error: ${results.error}`);
        continue;
      }
      
      // Check HEAD request
      console.log(`  HEAD Status: ${results.head.status}`);
      if (results.head.redirected) {
        console.error(`  ❌ HEAD request redirected to: ${results.head.location}`);
        console.error('  ⚠️ Redirects will break webhook signature verification!');
      } else {
        console.log('  ✅ HEAD request not redirected');
      }
      
      // Check POST request
      console.log(`  POST Status: ${results.post.status}`);
      if (results.post.redirected) {
        console.error(`  ❌ POST request redirected to: ${results.post.location}`);
        console.error('  ⚠️ Redirects will break webhook signature verification!');
      } else {
        console.log('  ✅ POST request not redirected');
        
        if (results.post.status >= 200 && results.post.status < 300) {
          console.log('  ✅ Webhook accepted successfully');
        } else if (results.post.status === 400 && results.post.body?.includes('verification')) {
          console.log('  ⚠️ Signature verification failed - check WEBHOOK_SECRET');
        } else if (results.post.status >= 400 && results.post.status < 500) {
          console.log(`  ❌ Client error (${results.post.status})`);
        } else if (results.post.status >= 500) {
          console.log(`  ❌ Server error (${results.post.status})`);
        }
        
        if (results.post.body) {
          const truncatedBody = results.post.body.substring(0, 150);
          console.log(`  Response: ${truncatedBody}${results.post.body.length > 150 ? '...' : ''}`);
        }
      }
    }
  }
  
  console.log('\n✅ Webhook tests completed');
  console.log('\nNext steps:');
  console.log('1. Check if any redirects were detected - fix these in your middleware');
  console.log('2. Verify your server logs for detailed information on webhook processing');
  console.log('3. Use Clerk Dashboard to replay webhooks if needed');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Error running tests:', error);
  process.exit(1);
}); 