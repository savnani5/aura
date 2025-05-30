import { NextRequest, NextResponse } from 'next/server';
import { VectorService } from '@/lib/vector-service';
import { AIChatbot } from '@/lib/ai-chatbot';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const roomName = searchParams.get('roomName');
    const query = searchParams.get('query');

    const vectorService = VectorService.getInstance();
    const chatbot = AIChatbot.getInstance();

    switch (action) {
      case 'list-transcripts': {
        // Access private transcripts map via reflection (for debugging)
        const transcriptsMap = (vectorService as any).transcripts as Map<string, any[]>;
        const allTranscripts: any = {};
        
        for (const [room, transcripts] of transcriptsMap.entries()) {
          allTranscripts[room] = transcripts.map(t => ({
            id: t.id,
            roomName: t.roomName,
            content: t.content.substring(0, 100) + '...',
            timestamp: new Date(t.timestamp).toISOString(),
            participants: t.participants,
            hasEmbedding: !!t.embedding
          }));
        }

        return NextResponse.json({
          success: true,
          transcripts: allTranscripts,
          totalRooms: transcriptsMap.size,
          totalTranscripts: Array.from(transcriptsMap.values()).reduce((sum, arr) => sum + arr.length, 0)
        });
      }

      case 'search-similar': {
        if (!roomName || !query) {
          return NextResponse.json(
            { error: 'Missing roomName or query parameters' },
            { status: 400 }
          );
        }

        const relevantTranscripts = await vectorService.searchRelevantTranscripts(query, roomName, 10);
        
        return NextResponse.json({
          success: true,
          query,
          roomName,
          relevantTranscripts: relevantTranscripts.map(t => ({
            id: t.id,
            roomName: t.roomName,
            content: t.content,
            timestamp: new Date(t.timestamp).toISOString(),
            participants: t.participants
          }))
        });
      }

      case 'test-context': {
        if (!roomName || !query) {
          return NextResponse.json(
            { error: 'Missing roomName or query parameters' },
            { status: 400 }
          );
        }

        const context = await vectorService.getChatContext(query, roomName, '');
        
        return NextResponse.json({
          success: true,
          query,
          roomName,
          context: {
            currentTranscripts: context.currentTranscripts,
            relevantHistory: context.relevantHistory.map(t => ({
              id: t.id,
              roomName: t.roomName,
              content: t.content,
              timestamp: new Date(t.timestamp).toISOString(),
              participants: t.participants
            }))
          }
        });
      }

      case 'conversation-history': {
        if (!roomName) {
          return NextResponse.json(
            { error: 'Missing roomName parameter' },
            { status: 400 }
          );
        }

        const history = chatbot.getConversationHistory(roomName);
        
        return NextResponse.json({
          success: true,
          roomName,
          conversationHistory: history.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp).toISOString()
          }))
        });
      }

      default: {
        return NextResponse.json({
          success: true,
          availableActions: [
            'list-transcripts - List all stored transcripts',
            'search-similar?roomName=X&query=Y - Search for similar transcripts',
            'test-context?roomName=X&query=Y - Test context retrieval',
            'conversation-history?roomName=X - Get conversation history for room'
          ]
        });
      }
    }
  } catch (error) {
    console.error('Error in AI debug API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Store test transcript data
export async function POST(request: NextRequest) {
  try {
    const { roomName, content, participants, customTimestamp } = await request.json();

    if (!roomName || !content || !participants) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, content, participants' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const vectorService = VectorService.getInstance();
    
    const transcript = {
      id: `test-${roomName}-${Date.now()}`,
      roomName,
      content,
      timestamp: customTimestamp || Date.now(),
      participants,
    };

    await vectorService.storeMeetingTranscript(transcript);

    return NextResponse.json({
      success: true,
      message: 'Test transcript stored successfully',
      transcript: {
        ...transcript,
        timestamp: new Date(transcript.timestamp).toISOString()
      }
    });

  } catch (error) {
    console.error('Error storing test transcript:', error);
    return NextResponse.json(
      { 
        error: 'Failed to store test transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 