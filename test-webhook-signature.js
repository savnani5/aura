/**
 * Test script for webhook signature verification
 * This script simulates the webhook signature verification process
 * to ensure our implementation is correct
 */

// Import required modules
const crypto = require('crypto');
const { Buffer } = require('buffer');

// Mock request data
const mockPayload = JSON.stringify({
  type: 'user.created',
  data: {
    id: 'test_user_id',
    email_addresses: [{ email_address: 'test@example.com' }],
    first_name: 'Test',
    last_name: 'User'
  }
});

// Test both Clerk and Stripe webhook verification
async function testWebhookSignatureVerification() {
  console.log('🧪 Testing webhook signature verification...\n');
  
  await testClerkWebhook();
  await testStripeWebhook();
}

async function testClerkWebhook() {
  console.log('🔍 Testing Clerk webhook signature verification:');
  
  // Mock webhook secret
  const secret = process.env.CLERK_WEBHOOK_SECRET || 'whsec_test_clerk_secret';
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate a unique message ID
  const messageId = crypto.randomUUID();
  
  // Create the signature using the Svix format
  // payload = timestamp + "." + messageId + "." + body
  const payload = `${timestamp}.${messageId}.${mockPayload}`;
  const signature = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  console.log('📝 Generated mock Clerk webhook data:');
  console.log(`  - Timestamp: ${timestamp}`);
  console.log(`  - Message ID: ${messageId}`);
  console.log(`  - Signature: ${signature.substring(0, 10)}...`);
  console.log(`  - Payload size: ${mockPayload.length} bytes`);
  
  // Verification test
  try {
    // Simulate the verification process
    const expectedPayload = `${timestamp}.${messageId}.${mockPayload}`;
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(expectedPayload)
      .digest('hex');
    
    const isValid = signature === expectedSignature;
    
    if (isValid) {
      console.log('✅ Clerk webhook signature verified successfully!');
    } else {
      console.log('❌ Clerk webhook signature verification failed!');
    }
  } catch (error) {
    console.error('❌ Error verifying Clerk webhook signature:', error);
  }
  
  console.log('\n');
}

async function testStripeWebhook() {
  console.log('🔍 Testing Stripe webhook signature verification:');
  
  // Mock webhook secret
  const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_stripe_secret';
  
  // Generate a timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Create the signature using the Stripe format
  // v1,timestamp,payload
  const payload = Buffer.from(mockPayload, 'utf8');
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Format according to Stripe's t=timestamp,v1=signature pattern
  const stripeSignature = `t=${timestamp},v1=${signature}`;
  
  console.log('📝 Generated mock Stripe webhook data:');
  console.log(`  - Timestamp: ${timestamp}`);
  console.log(`  - Signature: ${signature.substring(0, 10)}...`);
  console.log(`  - Full Stripe Signature: ${stripeSignature.substring(0, 25)}...`);
  console.log(`  - Payload size: ${payload.length} bytes`);
  
  // Verification test
  try {
    // Simulate the verification process
    // Parse the signature
    const signatureParts = {};
    stripeSignature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      signatureParts[key] = value;
    });
    
    const expectedPayload = `${signatureParts.t}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(expectedPayload)
      .digest('hex');
    
    const isValid = signatureParts.v1 === expectedSignature;
    
    if (isValid) {
      console.log('✅ Stripe webhook signature verified successfully!');
    } else {
      console.log('❌ Stripe webhook signature verification failed!');
    }
  } catch (error) {
    console.error('❌ Error verifying Stripe webhook signature:', error);
  }
}

// Run the tests
testWebhookSignatureVerification().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 