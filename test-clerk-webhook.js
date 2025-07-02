/**
 * Test script for Clerk webhook handling
 * This script creates a valid signature and sends test webhook requests to your endpoint
 */

require('dotenv').config();
const crypto = require('crypto');
const fetch = require('node-fetch');

// Get or set the webhook secret
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || 'whsec_test';

// Create a sample webhook payload for 'user.created'
const payload = {
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
};

// Function to generate a valid signature for the payload
function generateSignature(payload) {
  // Convert to string if needed
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate a unique message ID
  const messageId = crypto.randomUUID();
  
  // Create the signature using the Svix format
  // payload = timestamp + "." + messageId + "." + body
  const signaturePayload = `${timestamp}.${messageId}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(signaturePayload)
    .digest('base64');
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'svix-id': messageId,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`
    },
    body: payloadStr
  };
}

// Test endpoints
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

// Run the tests
async function runTests() {
  console.log('🧪 Testing Clerk webhook endpoints...\n');
  
  const signedRequest = generateSignature(payload);
  
  console.log('📝 Using webhook payload:');
  console.log(JSON.stringify(payload, null, 2).substring(0, 200) + '...');
  
  console.log('\n📋 Using headers:');
  console.log(JSON.stringify(signedRequest.headers, null, 2));
  
  for (const endpoint of endpoints) {
    console.log(`\n🌐 Testing ${endpoint.name}: ${endpoint.url}`);
    
    try {
      // First make a HEAD request to check for redirects
      const headResponse = await fetch(endpoint.url, { 
        method: 'HEAD',
        redirect: 'manual' 
      });
      
      console.log(`  - HEAD status: ${headResponse.status}`);
      if (headResponse.status >= 300 && headResponse.status < 400) {
        console.log(`  - ⚠️ Redirect detected to: ${headResponse.headers.get('location')}`);
      } else {
        console.log(`  - ✅ No redirect detected`);
      }
      
      // Then send the actual webhook request with proper signature
      const postResponse = await fetch(endpoint.url, {
        method: 'POST',
        headers: signedRequest.headers,
        body: signedRequest.body,
        redirect: 'manual'
      });
      
      console.log(`  - POST status: ${postResponse.status}`);
      
      if (postResponse.status >= 300 && postResponse.status < 400) {
        console.log(`  - ⚠️ POST request redirected to: ${postResponse.headers.get('location')}`);
      } else {
        console.log(`  - ✅ POST request not redirected`);
        
        try {
          const responseBody = await postResponse.text();
          console.log(`  - Response body: ${responseBody.substring(0, 200)}`);
        } catch (error) {
          console.log(`  - Could not read response body: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`  - ❌ Error testing ${endpoint.url}: ${error.message}`);
    }
  }
}

runTests().catch(error => {
  console.error('❌ Error running tests:', error);
  process.exit(1);
}); 