import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver, WebhookEvent } from 'livekit-server-sdk';

/**
 * LiveKit Webhook Handler
 * Automatically detects when participants leave and rooms become empty
 * Triggers meeting end processing when the last participant leaves
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎯 LIVEKIT WEBHOOK: Received webhook');

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.error('❌ LIVEKIT WEBHOOK: Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET');
      return NextResponse.json({ error: 'Webhook credentials not configured' }, { status: 500 });
    }

    // Get the raw body and headers
    const body = await request.text();
    const authHeader = request.headers.get('authorization');
    
    console.log('📋 LIVEKIT WEBHOOK: Headers:', {
      authorization: authHeader ? 'present' : 'missing',
      contentType: request.headers.get('content-type'),
      contentLength: body.length
    });

    if (!authHeader) {
      console.error('❌ LIVEKIT WEBHOOK: Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    // Verify the webhook
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    let event: WebhookEvent;
    
    try {
      event = await receiver.receive(body, authHeader);
      console.log(`📦 LIVEKIT WEBHOOK: Verified event type: ${event.event}`);
    } catch (error) {
      console.error('❌ LIVEKIT WEBHOOK: Failed to verify webhook:', error);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Handle different event types
    switch (event.event) {
      case 'participant_joined':
        await handleParticipantJoined(event);
        break;
        
      case 'participant_left':
        await handleParticipantLeft(event);
        break;
        
      case 'room_started':
        await handleRoomStarted(event);
        break;
        
      case 'room_finished':
        await handleRoomFinished(event);
        break;
        
      default:
        console.log(`⚠️ LIVEKIT WEBHOOK: Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ success: true, event: event.event });

  } catch (error) {
    console.error('❌ LIVEKIT WEBHOOK: Error processing webhook:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleParticipantJoined(event: WebhookEvent) {
  const { room, participant } = event;
  console.log(`👋 LIVEKIT WEBHOOK: Participant ${participant?.name || participant?.identity} joined room ${room?.name}`);
  
  // Update database that room is active (optional)
  // This helps keep our database in sync but doesn't drive the core logic
}

async function handleParticipantLeft(event: WebhookEvent) {
  const { room, participant } = event;
  const roomName = room?.name;
  const participantName = participant?.name || participant?.identity;
  
  console.log(`👋 LIVEKIT WEBHOOK: Participant ${participantName} left room ${roomName}`);
  
  if (!roomName) {
    console.warn('⚠️ LIVEKIT WEBHOOK: Room name missing from participant_left event');
    return;
  }

  // Check if room is now empty and end meeting if needed
  await checkAndEndMeetingIfEmpty(roomName, 'participant_left');
}

async function handleRoomStarted(event: WebhookEvent) {
  const { room } = event;
  console.log(`🏠 LIVEKIT WEBHOOK: Room ${room?.name} started`);
}

async function handleRoomFinished(event: WebhookEvent) {
  const { room } = event;
  const roomName = room?.name;
  
  console.log(`🏠 LIVEKIT WEBHOOK: Room ${roomName} finished (all participants left)`);
  
  if (!roomName) {
    console.warn('⚠️ LIVEKIT WEBHOOK: Room name missing from room_finished event');
    return;
  }

  // Room is definitely empty, end the meeting
  await checkAndEndMeetingIfEmpty(roomName, 'room_finished');
}

/**
 * Check if a room is empty and end the meeting if needed
 * This is the core logic that replaces database participant tracking
 */
async function checkAndEndMeetingIfEmpty(roomName: string, trigger: string) {
  try {
    console.log(`🔍 LIVEKIT WEBHOOK: Checking if room ${roomName} is empty (trigger: ${trigger})`);

    // Call our room status check endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/meetings/check-room-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
        force: trigger === 'room_finished' // Force end if room_finished event
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.meetingEnded) {
        console.log(`✅ LIVEKIT WEBHOOK: Meeting ended for room ${roomName} due to ${trigger}`);
      } else {
        console.log(`👥 LIVEKIT WEBHOOK: Meeting continues in room ${roomName} - ${result.participantCount || 0} participants`);
      }
    } else {
      console.error(`❌ LIVEKIT WEBHOOK: Failed to check room status for ${roomName}:`, response.status);
    }

  } catch (error) {
    console.error(`❌ LIVEKIT WEBHOOK: Error checking room ${roomName}:`, error);
  }
}
