import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AIChatbot } from '@/lib/ai-chatbot';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, roomName, userName, currentTranscripts, isLiveMeeting } = await request.json();

    // Validate required fields
    if (!message || !roomName || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: message, roomName, userName' },
        { status: 400 }
      );
    }

    // Check if required API keys are configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const chatbot = AIChatbot.getInstance();
    
    // Process the chat message with optional current transcripts
    const response = await chatbot.processChat(
      message,
      roomName,
      userName,
      currentTranscripts,
      isLiveMeeting || false
    );

    return NextResponse.json({
      success: true,
      response: response.message,
      usedWebSearch: response.usedWebSearch || false,
      usedContext: response.usedContext || false,
      relevantTranscripts: response.relevantTranscripts || 0,
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