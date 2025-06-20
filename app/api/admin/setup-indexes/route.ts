import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Admin secret for protection
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret-change-this';
const MONGODB_URI = process.env.MONGODB_URI;

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB URI not configured' }, { status: 500 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    const results = [];

    // Setup indexes for meetings collection
    const meetingsCollection = db.collection('meetings');
    await meetingsCollection.createIndex({ "roomName": 1 }, { name: "roomName_1" });
    await meetingsCollection.createIndex({ "roomId": 1 }, { name: "roomId_1" });
    await meetingsCollection.createIndex({ "startedAt": -1 }, { name: "startedAt_-1" });
    await meetingsCollection.createIndex({ "roomName": 1, "startedAt": -1 }, { name: "roomName_1_startedAt_-1" });
    await meetingsCollection.createIndex({ "participants.userId": 1 }, { name: "participants_userId_1" });
    results.push('meetings indexes created');

    // Setup indexes for transcriptembeddings collection
    const embeddingsCollection = db.collection('transcriptembeddings');
    await embeddingsCollection.createIndex({ "meetingId": 1 }, { name: "meetingId_1" });
    await embeddingsCollection.createIndex({ "meetingId": 1, "transcriptIndex": 1 }, { name: "meetingId_1_transcriptIndex_1" });
    results.push('transcriptembeddings indexes created');

    // Setup indexes for tasks collection
    const tasksCollection = db.collection('tasks');
    await tasksCollection.createIndex({ "roomId": 1 }, { name: "roomId_1" });
    await tasksCollection.createIndex({ "status": 1 }, { name: "status_1" });
    await tasksCollection.createIndex({ "roomId": 1, "status": 1 }, { name: "roomId_1_status_1" });
    await tasksCollection.createIndex({ "dueDate": 1 }, { name: "dueDate_1" });
    results.push('tasks indexes created');

    // Setup indexes for rooms collection
    const roomsCollection = db.collection('rooms');
    await roomsCollection.createIndex({ "name": 1 }, { name: "name_1", unique: true });
    await roomsCollection.createIndex({ "createdBy": 1 }, { name: "createdBy_1" });
    await roomsCollection.createIndex({ "createdAt": -1 }, { name: "createdAt_-1" });
    results.push('rooms indexes created');

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'All production indexes created successfully',
      results 
    });

  } catch (error) {
    console.error('Error setting up indexes:', error);
    return NextResponse.json({ 
      error: 'Failed to setup indexes', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 