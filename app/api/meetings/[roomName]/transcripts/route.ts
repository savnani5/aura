import { NextRequest, NextResponse } from 'next/server';
import { RAGService } from '@/lib/rag-service';
import { DatabaseService } from '@/lib/mongodb';

// POST /api/meetings/[roomName]/transcripts - Store transcripts with embeddings after meeting ends
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { meetingId, transcripts } = await request.json();

    // Validate required fields
    if (!meetingId || !transcripts || !Array.isArray(transcripts)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: meetingId, transcripts (array)'
      }, { status: 400 });
    }

    // Check if required API keys are configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    const ragService = RAGService.getInstance();
    const dbService = DatabaseService.getInstance();

    // Verify the meeting exists and belongs to the room
    const meeting = await dbService.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({
        success: false,
        error: 'Meeting not found'
      }, { status: 404 });
    }

    if (meeting.roomName !== roomName) {
      return NextResponse.json({
        success: false,
        error: 'Meeting does not belong to this room'
      }, { status: 400 });
    }

    // Validate transcript format
    const validTranscripts = transcripts.filter(transcript => 
      transcript.speaker && 
      transcript.text && 
      transcript.timestamp
    );

    if (validTranscripts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid transcripts provided. Each transcript must have speaker, text, and timestamp.'
      }, { status: 400 });
    }

    // Convert timestamp strings to Date objects if needed
    const processedTranscripts = validTranscripts.map(transcript => ({
      speaker: transcript.speaker,
      text: transcript.text,
      timestamp: new Date(transcript.timestamp),
      // Enhanced fields for speaker diarization
      speakerConfidence: transcript.speakerConfidence,
      deepgramSpeaker: transcript.deepgramSpeaker,
      participantId: transcript.participantId,
      isLocal: transcript.isLocal
    }));

    // Store transcripts with embeddings
    await ragService.storeTranscriptEmbeddings(meetingId, processedTranscripts);

    return NextResponse.json({
      success: true,
      message: `Successfully stored ${processedTranscripts.length} transcripts with embeddings`,
      transcriptsStored: processedTranscripts.length
    });

  } catch (error) {
    console.error('Error storing transcripts:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to store transcripts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/meetings/[roomName]/transcripts - Get transcripts for a specific meeting
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({
        success: false,
        error: 'meetingId query parameter is required'
      }, { status: 400 });
    }

    const dbService = DatabaseService.getInstance();

    // Get the meeting with transcripts
    const meeting = await dbService.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({
        success: false,
        error: 'Meeting not found'
      }, { status: 404 });
    }

    if (meeting.roomName !== roomName) {
      return NextResponse.json({
        success: false,
        error: 'Meeting does not belong to this room'
      }, { status: 400 });
    }

    // Return transcripts without embeddings (for frontend display)
    const transcripts = (meeting.transcripts || []).map(transcript => ({
      speaker: transcript.speaker,
      text: transcript.text,
      timestamp: transcript.timestamp,
      hasEmbedding: transcript.embedding && transcript.embedding.length > 0,
      // Enhanced fields for consistency with live transcription
      speakerConfidence: transcript.speakerConfidence,
      deepgramSpeaker: transcript.deepgramSpeaker,
      participantId: transcript.participantId,
      isLocal: transcript.isLocal
    }));

    return NextResponse.json({
      success: true,
      data: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        transcripts,
        totalTranscripts: transcripts.length,
        transcriptsWithEmbeddings: transcripts.filter(t => t.hasEmbedding).length
      }
    });

  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transcripts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 