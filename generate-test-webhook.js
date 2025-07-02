/**
 * Generate a properly signed test webhook request
 * This script creates the proper signature for testing Clerk and Stripe webhooks
 */

const crypto = require('crypto');
const { Buffer } = require('buffer');
require('dotenv').config();

// Get secrets from environment or use test values
const CLERK_SECRET = process.env.CLERK_WEBHOOK_SECRET || 'whsec_test';
const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

// Create a sample Clerk webhook payload
const clerkPayload = {
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

// Create a sample Stripe webhook payload
const stripePayload = {
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_test_' + Date.now(),
      customer: 'cus_test_' + Date.now(),
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      created: Math.floor(Date.now() / 1000)
    }
  },
  livemode: false,
  api_version: '2020-08-27'
};

function generateClerkSignature(payload) {
  // Convert payload to string if it's an object
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate a unique message ID
  const messageId = crypto.randomUUID();
  
  // Create the signature using the Svix format
  // payload = timestamp + "." + messageId + "." + body
  const signaturePayload = `${timestamp}.${messageId}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', CLERK_SECRET)
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

function generateStripeSignature(payload) {
  // Convert payload to string if it's an object
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Create the signature using the Stripe format
  // v1,timestamp,payload
  const signaturePayload = `${timestamp}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', STRIPE_SECRET)
    .update(signaturePayload)
    .digest('hex');
  
  // Format according to Stripe's t=timestamp,v1=signature pattern
  const stripeSignature = `t=${timestamp},v1=${signature}`;
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': stripeSignature
    },
    body: payloadStr
  };
}

// Generate the test webhook requests
const clerkRequest = generateClerkSignature(clerkPayload);
const stripeRequest = generateStripeSignature(stripePayload);

console.log('\n📋 Clerk Webhook Test Request:');
console.log('Headers:');
console.log(JSON.stringify(clerkRequest.headers, null, 2));
console.log('\nBody:');
console.log(clerkRequest.body.substring(0, 100) + '...');

console.log('\n📋 Stripe Webhook Test Request:');
console.log('Headers:');
console.log(JSON.stringify(stripeRequest.headers, null, 2));
console.log('\nBody:');
console.log(stripeRequest.body.substring(0, 100) + '...');

console.log('\n✅ Generated test webhook requests with valid signatures');
console.log('You can use these to test your webhook handlers by sending POST requests with these headers and bodies.');

// Instructions for manual testing
console.log('\n🧪 To test with curl:');

console.log('\n1. Clerk webhook:');
console.log(`curl -X POST https://tryohm.com/api/webhooks/clerk \\
  -H "Content-Type: application/json" \\
  -H "svix-id: ${clerkRequest.headers['svix-id']}" \\
  -H "svix-timestamp: ${clerkRequest.headers['svix-timestamp']}" \\
  -H "svix-signature: ${clerkRequest.headers['svix-signature']}" \\
  -d '${clerkRequest.body}'`);

console.log('\n2. Stripe webhook:');
console.log(`curl -X POST https://tryohm.com/api/webhooks/stripe \\
  -H "Content-Type: application/json" \\
  -H "stripe-signature: ${stripeRequest.headers['stripe-signature']}" \\
  -d '${stripeRequest.body}'`);

console.log('\n3. Using node-fetch:');
console.log(`
const fetch = require('node-fetch');

// Clerk test
fetch('https://tryohm.com/api/webhooks/clerk', {
  method: 'POST',
  headers: ${JSON.stringify(clerkRequest.headers, null, 2)},
  body: '${clerkRequest.body}'
})
.then(res => res.text())
.then(body => console.log('Clerk response:', body))
.catch(err => console.error('Clerk error:', err));

// Stripe test
fetch('https://tryohm.com/api/webhooks/stripe', {
  method: 'POST',
  headers: ${JSON.stringify(stripeRequest.headers, null, 2)},
  body: '${stripeRequest.body}'
})
.then(res => res.text())
.then(body => console.log('Stripe response:', body))
.catch(err => console.error('Stripe error:', err));
`); 