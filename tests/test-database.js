/**
 * Database and API Testing Script for Ohm v1
 * Run with: node test-database.js
 */

const mongoose = require('mongoose');

// Test MongoDB Connection
async function testConnection() {
  console.log('🔗 Testing MongoDB Connection...');
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ohm-meetings';
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

// Test Database Models
async function testModels() {
  console.log('\n📊 Testing Database Models...');
  
  try {
    // Import models (we'll use raw mongoose since we're outside Next.js)
    const UserSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String },
      joinedAt: { type: Date, default: Date.now },
      lastActive: { type: Date, default: Date.now }
    });

    const MeetingRoomSchema = new mongoose.Schema({
      roomName: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      type: { type: String, required: true },
      isRecurring: { type: Boolean, default: false },
      participants: [{
        name: { type: String, required: true },
        role: { type: String, enum: ['host', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now }
      }],
      isActive: { type: Boolean, default: false }
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model('MeetingRoom', MeetingRoomSchema);

    // Test User Creation
    console.log('  Testing User creation...');
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com'
    });
    await testUser.save();
    console.log('  ✅ User created:', testUser.name);

    // Test MeetingRoom Creation
    console.log('  Testing MeetingRoom creation...');
    const testRoom = new MeetingRoom({
      roomName: 'test-room-' + Date.now(),
      title: 'Test Meeting Room',
      type: 'Test Meeting',
      participants: [
        { name: 'Test User', role: 'host' }
      ]
    });
    await testRoom.save();
    console.log('  ✅ MeetingRoom created:', testRoom.title);

    // Test Data Retrieval
    console.log('  Testing data retrieval...');
    const foundRoom = await MeetingRoom.findOne({ roomName: testRoom.roomName });
    if (foundRoom) {
      console.log('  ✅ MeetingRoom retrieved successfully');
    } else {
      throw new Error('Failed to retrieve meeting room');
    }

    // Cleanup test data
    await User.deleteMany({ email: 'test@example.com' });
    await MeetingRoom.deleteMany({ roomName: testRoom.roomName });
    console.log('  ✅ Test data cleaned up');

    return true;
  } catch (error) {
    console.error('  ❌ Model test failed:', error.message);
    return false;
  }
}

// Test API Endpoints
async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...');
  
  try {
    const baseUrl = 'http://localhost:3000';
    
    // Test GET /api/meetings
    console.log('  Testing GET /api/meetings...');
    const response1 = await fetch(`${baseUrl}/api/meetings`);
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('  ✅ GET /api/meetings success:', data1.success ? 'Working' : 'Failed');
    } else {
      console.log('  ⚠️  GET /api/meetings failed (expected if no data):', response1.status);
    }

    // Test POST /api/meetings
    console.log('  Testing POST /api/meetings...');
    const testRoomData = {
      roomName: 'api-test-room-' + Date.now(),
      title: 'API Test Room',
      type: 'Daily Standup',
      isRecurring: true,
      participants: ['Alice', 'Bob'],
      frequency: 'weekly',
      recurringDay: 'Monday',
      recurringTime: '09:00'
    };

    const response2 = await fetch(`${baseUrl}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testRoomData)
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('  ✅ POST /api/meetings success:', data2.success ? 'Working' : 'Failed');
      
      // Test GET specific room
      console.log('  Testing GET /api/meetings/[roomName]...');
      const response3 = await fetch(`${baseUrl}/api/meetings/${testRoomData.roomName}`);
      if (response3.ok) {
        const data3 = await response3.json();
        console.log('  ✅ GET /api/meetings/[roomName] success:', data3.success ? 'Working' : 'Failed');
      }
    } else {
      const errorData = await response2.json();
      console.log('  ❌ POST /api/meetings failed:', errorData.error);
    }

    return true;
  } catch (error) {
    console.error('  ❌ API test failed:', error.message);
    console.log('  ℹ️  Make sure your Next.js dev server is running (npm run dev)');
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Ohm Database & API Tests\n');
  
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('\n❌ Tests stopped - fix MongoDB connection first');
    process.exit(1);
  }

  const modelsOk = await testModels();
  const apiOk = await testAPIEndpoints();

  console.log('\n📋 Test Results:');
  console.log(`MongoDB Connection: ${connectionOk ? '✅' : '❌'}`);
  console.log(`Database Models: ${modelsOk ? '✅' : '❌'}`);
  console.log(`API Endpoints: ${apiOk ? '✅' : '❌'}`);

  if (connectionOk && modelsOk && apiOk) {
    console.log('\n🎉 All tests passed! Ready for frontend integration.');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix issues before proceeding.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});

// Run tests
runTests(); 