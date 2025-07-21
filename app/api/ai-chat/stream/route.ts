import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AIChatbot } from '@/lib/ai/chatbot';

export async function POST(request: NextRequest) {
  try {
    const { message, roomName, userName, currentTranscripts, isLiveMeeting } = await request.json();

    // Validate required fields
    if (!message || !roomName || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: message, roomName, userName' },
        { status: 400 }
      );
    }

    // For live meetings, allow guest access. For other uses, require authentication
    if (!isLiveMeeting) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required for non-live meeting AI chat' },
          { status: 401 }
        );
      }
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

    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json(
        { error: 'Pinecone API key not configured' },
        { status: 500 }
      );
    }

    const chatbot = AIChatbot.getInstance();
    
    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Process the chat message with streaming
          await chatbot.processChatStream(
            message,
            roomName,
            userName,
            (chunk) => {
              // Send each chunk to the client
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            },
            currentTranscripts,
            isLiveMeeting || false
          );
          
          // End the stream
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in streaming AI chat:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error in streaming AI chat API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 