/**
 * Script to test webhook URL handling with trailing slashes and redirects
 * This script sends test requests to the webhook endpoints with various URL formats
 */

const fetch = require('node-fetch');

// Test environments
const environments = [
  {
    name: 'Local',
    baseUrl: 'http://localhost:3000',
  },
  {
    name: 'Production',
    baseUrl: 'https://tryohm.com',
  },
];

// Test URLs with different trailing slash patterns
const urlVariations = [
  '/api/webhooks/clerk',
  '/api/webhooks/clerk/',
  '/api/webhooks/stripe',
  '/api/webhooks/stripe/',
];

// Mock payloads
const mockClerkPayload = JSON.stringify({
  type: 'user.created',
  data: {
    id: 'test_user_id',
    email_addresses: [{ email_address: 'test@example.com' }],
    first_name: 'Test',
    last_name: 'User'
  }
});

const mockStripePayload = JSON.stringify({
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_test',
      customer: 'cus_test'
    }
  }
});

async function testWebhookUrls() {
  console.log('🧪 Testing webhook URL handling...\n');
  
  for (const env of environments) {
    console.log(`🌐 Testing ${env.name} environment (${env.baseUrl})`);
    
    for (const urlPath of urlVariations) {
      const fullUrl = `${env.baseUrl}${urlPath}`;
      const isClerk = urlPath.includes('clerk');
      const payload = isClerk ? mockClerkPayload : mockStripePayload;
      
      try {
        console.log(`📡 Testing URL: ${fullUrl}`);
        
        // First make a HEAD request to check for redirects
        const headResponse = await fetch(fullUrl, { method: 'HEAD', redirect: 'manual' });
        
        console.log(`  - HEAD status: ${headResponse.status}`);
        if (headResponse.status >= 300 && headResponse.status < 400) {
          console.log(`  - ⚠️ Redirect detected to: ${headResponse.headers.get('location')}`);
        } else {
          console.log(`  - ✅ No redirect detected`);
        }
        
        // Then send a POST with proper headers but invalid signature
        // We're just testing the URL handling, not the signature verification
        const headers = isClerk 
          ? {
              'Content-Type': 'application/json',
              'svix-id': 'test_msg_id',
              'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
              'svix-signature': 'v1,invalid_signature'
            }
          : {
              'Content-Type': 'application/json',
              'stripe-signature': 't=123456789,v1=invalid_signature'
            };
            
        const postResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: headers,
          body: payload,
          redirect: 'manual' // Don't follow redirects automatically
        });
        
        console.log(`  - POST status: ${postResponse.status}`);
        
        if (postResponse.status >= 300 && postResponse.status < 400) {
          console.log(`  - ⚠️ POST request redirected to: ${postResponse.headers.get('location')}`);
        } else {
          console.log(`  - ✅ POST request not redirected`);
          
          try {
            const responseBody = await postResponse.text();
            console.log(`  - Response body: ${responseBody.substring(0, 100)}${responseBody.length > 100 ? '...' : ''}`);
          } catch (error) {
            console.log(`  - Could not read response body: ${error.message}`);
          }
        }
      } catch (error) {
        console.error(`  - ❌ Error testing ${fullUrl}: ${error.message}`);
      }
      
      console.log('');
    }
  }
}

// Run the test
testWebhookUrls().catch(error => {
  console.error('❌ Error running tests:', error);
  process.exit(1);
}); 