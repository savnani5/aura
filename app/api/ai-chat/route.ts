import { NextRequest, NextResponse } from 'next/server';
import { AIChatbot } from '@/lib/ai-chatbot';

export async function POST(request: NextRequest) {
  try {
    const { message, roomName, userName } = await request.json();

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
      userName
    );

    return NextResponse.json({
      success: true,
      response: response.message,
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