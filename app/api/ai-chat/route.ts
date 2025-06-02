import { NextRequest, NextResponse } from 'next/server';
import { AIChatbot } from '@/lib/ai-chatbot';

export async function POST(request: NextRequest) {
  try {
    const { message, roomName, userName, currentTranscripts } = await request.json();

    // Validate required fields
    if (!message || !roomName || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: message, roomName, userName' },
        { status: 400 }
      );
    }

    // Check if Anthropic API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const chatbot = AIChatbot.getInstance();
    
    // Process the chat message
    const response = await chatbot.processChat(
      message,
      roomName,
      userName,
      currentTranscripts || ''
    );

    return NextResponse.json({
      success: true,
      response: response.message,
      usedContext: response.usedContext,
      relevantTranscripts: response.relevantTranscripts,
      usedWebSearch: response.usedWebSearch || false,
      citations: response.citations,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Error in AI chat API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Store meeting transcript endpoint
export async function PUT(request: NextRequest) {
  try {
    const { roomName, transcriptText, participants } = await request.json();

    if (!roomName || !transcriptText || !participants) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, transcriptText, participants' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const chatbot = AIChatbot.getInstance();
    await chatbot.storeMeetingTranscript(roomName, transcriptText, participants);

    return NextResponse.json({
      success: true,
      message: 'Transcript stored successfully',
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Error storing transcript:', error);
    return NextResponse.json(
      { 
        error: 'Failed to store transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 