import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database/mongodb';
import { HybridRAGService } from '@/lib/ai/hybrid-rag';
import { EmailService } from '@/lib/services/email';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

// Simple in-memory lock to prevent race conditions during meeting end
const meetingEndLocks = new Map<string, Promise<any>>();

// Helper function to acquire a lock for meeting end processing
async function withMeetingEndLock<T>(meetingId: string, operation: () => Promise<T>): Promise<T> {
  // Check if there's already an operation in progress for this meeting
  const existingLock = meetingEndLocks.get(meetingId);
  if (existingLock) {
    console.log(`🔒 Meeting ${meetingId} is already being processed, waiting for completion...`);
    
    try {
      // Wait for the existing operation to complete and return its result
      const result = await existingLock;
      console.log(`✅ Meeting ${meetingId} processing completed by another request`);
      return result;
    } catch (error) {
      console.log(`❌ Previous processing failed for meeting ${meetingId}, continuing with new attempt`);
      // If the previous operation failed, we'll try again
    }
  }

  // Create a new lock for this operation
  const operationPromise = operation();
  meetingEndLocks.set(meetingId, operationPromise);

  try {
    const result = await operationPromise;
    return result;
  } finally {
    // Always clean up the lock when done
    meetingEndLocks.delete(meetingId);
  }
}

// Helper function to deduplicate transcripts
function deduplicateTranscripts(transcripts: Array<{
  speaker: string;
  text: string;
  timestamp: Date;
  // Enhanced fields for speaker diarization
  speakerConfidence?: number;
  deepgramSpeaker?: number;
  participantId?: string;
  isLocal?: boolean;
}>): Array<{
  speaker: string;
  text: string;
  timestamp: Date;
  speakerConfidence?: number;
  deepgramSpeaker?: number;
  participantId?: string;
  isLocal?: boolean;
}> {
  return transcripts
    .filter(t => t.text && t.text.trim().length > 0) // Remove empty transcripts
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Sort by timestamp
    .reduce((acc, current) => {
      const currentText = current.text.trim();
      
      // Remove exact duplicates and similar content
      let isDuplicate = false;
      let wasReplaced = false;
      
      for (let index = 0; index < acc.length; index++) {
        const existingTranscript = acc[index];
        const existingText = existingTranscript.text.trim();
        
        // Exact match (same speaker, same text)
        if (existingTranscript.speaker === current.speaker && existingText === currentText) {
          isDuplicate = true;
          break;
        }
        
        // Check if current text is a substring of existing text (fragment)
        if (existingTranscript.speaker === current.speaker && existingText.includes(currentText) && currentText.length < existingText.length * 0.8) {
          isDuplicate = true;
          break;
        }
        
        // Check if existing text is a substring of current text (update to longer version)
        if (existingTranscript.speaker === current.speaker && currentText.includes(existingText) && existingText.length < currentText.length * 0.8) {
          // Replace the shorter version with the longer one
          acc[index] = current;
          wasReplaced = true;
          break;
        }
        
        // Check for concatenated duplicates (e.g., "text. text." patterns or combined transcripts)
        if (existingTranscript.speaker === current.speaker) {
          // Split by sentences and check for repetition
          const sentences1 = existingText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
          const sentences2 = currentText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
          
          // If one transcript contains all sentences of the other, it's likely a duplicate
          const overlap1 = sentences1.filter(s1 => sentences2.some(s2 => s2.includes(s1) || s1.includes(s2))).length;
          const overlap2 = sentences2.filter(s2 => sentences1.some(s1 => s1.includes(s2) || s2.includes(s1))).length;
          
          if (overlap1 >= sentences1.length * 0.7 || overlap2 >= sentences2.length * 0.7) {
            // Keep the longer, more complete version
            if (currentText.length > existingText.length) {
              acc[index] = current;
              wasReplaced = true;
            } else {
              isDuplicate = true;
            }
            break;
          }
        }
      }
      
      // Also check if current text is a combination of multiple previous transcripts
      if (!isDuplicate && !wasReplaced && acc.length > 1) {
        const sameSpeakerTranscripts = acc.filter(t => t.speaker === current.speaker);
        if (sameSpeakerTranscripts.length > 1) {
          const combinedText = sameSpeakerTranscripts.map(t => t.text.trim()).join(' ');
          
          // If current text contains the combined text of multiple previous transcripts, it's likely a concatenated duplicate
          if (currentText.includes(combinedText.substring(0, Math.min(combinedText.length, currentText.length * 0.8)))) {
            console.log(`🔍 Detected concatenated transcript - skipping: "${currentText.substring(0, 100)}..."`);
            isDuplicate = true;
          }
        }
      }
      
      // Only add if it's not a duplicate and wasn't used as a replacement
      if (!isDuplicate && !wasReplaced) {
        acc.push(current);
      }
      
      return acc;
    }, [] as typeof transcripts);
}

// POST /api/meetings/[roomName]/end - Handle meeting end, store transcripts, generate summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    const { 
      meetingId,
      transcripts = [],
      participants = [],
      endedAt,
      duration
    } = await request.json();

    // Validate required fields
    if (!meetingId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: meetingId'
      }, { status: 400 });
    }

    // Use lock mechanism to prevent race conditions
    return await withMeetingEndLock(meetingId, async () => {
      const dbService = DatabaseService.getInstance();
      const ragService = HybridRAGService.getInstance();

      // Get the meeting to verify it exists (check again inside lock)
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

      // Check if meeting is already ended - if so, return success to prevent duplicates
      if (meeting.endedAt) {
        console.log(`⚠️ Meeting ${meetingId} already ended at ${meeting.endedAt}. Returning cached result to prevent duplicate.`);
        
        // Return success response with existing meeting data to prevent duplicate processing
        return NextResponse.json({
          success: true,
          message: 'Meeting was already ended successfully',
          data: {
            meetingId: meeting._id,
            roomName: meeting.roomName,
            endedAt: meeting.endedAt.toISOString(),
            duration: meeting.duration || 0,
            transcriptsStored: meeting.transcripts?.length || 0,
            summaryGenerated: !!meeting.summary,
            alreadyEnded: true, // Flag to indicate this was already processed
            redirectUrl: meeting.roomId 
              ? `/meetingroom/${roomName}` 
              : '/'
          }
        });
      }

      console.log(`🔚 Ending meeting: ${meeting.title || meeting.type} (${meetingId})`);

      // Calculate end time and duration if not provided
      const meetingEndedAt = endedAt ? new Date(endedAt) : new Date();
      const calculatedDuration = duration || Math.round(
        (meetingEndedAt.getTime() - new Date(meeting.startedAt).getTime()) / (1000 * 60)
      );

      // Prepare meeting update data
      const updateData: any = {
        endedAt: meetingEndedAt,
        duration: calculatedDuration
      };

      // Update participants if provided
      if (participants.length > 0) {
        updateData.participants = participants.map((p: any) => ({
          ...p,
          leftAt: p.leftAt ? new Date(p.leftAt) : meetingEndedAt
        }));
      }

      // Store transcripts with embeddings if provided
      let transcriptsStored = 0;
      let processedTranscripts: any[] = [];
      if (transcripts.length > 0) {
        console.log(`📝 Processing ${transcripts.length} transcripts...`);
        
        // Validate transcript format
        const validTranscripts = transcripts.filter((transcript: any) => 
          transcript.speaker && 
          transcript.text && 
          transcript.timestamp
        );

        if (validTranscripts.length > 0) {
          // Convert timestamp strings to Date objects if needed
          const rawTranscripts = validTranscripts.map((transcript: any) => ({
            speaker: transcript.speaker,
            text: transcript.text,
            timestamp: new Date(transcript.timestamp),
            // Enhanced fields for speaker diarization
            speakerConfidence: transcript.speakerConfidence,
            deepgramSpeaker: transcript.deepgramSpeaker,
            participantId: transcript.participantId,
            isLocal: transcript.isLocal
          }));
          
          // Apply deduplication logic before storing
          processedTranscripts = deduplicateTranscripts(rawTranscripts);
          transcriptsStored = processedTranscripts.length;
          console.log(`📝 Deduplicated ${validTranscripts.length} → ${transcriptsStored} transcripts for storage`);
        }
      }

      // CHECK: If no transcripts were processed, delete the meeting instead of saving it
      if (transcriptsStored === 0) {
        console.log(`🗑️ No transcripts found - deleting empty meeting record: ${meetingId}`);
        
        try {
          // Delete the meeting record since it has no content
          await dbService.deleteMeeting(meetingId);
          console.log(`✅ Deleted empty meeting record`);
          
          return NextResponse.json({
            success: true,
            message: 'Meeting ended but no content was recorded - meeting record removed',
            data: {
              meetingId: null, // Indicate meeting was deleted
              roomName,
              endedAt: meetingEndedAt.toISOString(),
              duration: calculatedDuration,
              transcriptsStored: 0,
              summaryGenerated: false,
              meetingDeleted: true,
              redirectUrl: meeting.roomId 
                ? `/meetingroom/${roomName}` 
                : '/'
            }
          });
        } catch (deleteError) {
          console.error('Error deleting empty meeting:', deleteError);
          // Fall through to normal flow if deletion fails
        }
      }

      // Update meeting with end data first (only if we have transcripts)
      await dbService.updateMeeting(meetingId, updateData);
      console.log(`✅ Updated meeting with end data`);

      // Now store transcripts with embeddings (after meeting update)
      if (processedTranscripts.length > 0) {
        try {
          console.log(`📝 Storing ${processedTranscripts.length} transcripts with embeddings...`);
          
          // Store transcripts with embeddings using RAG service
          await ragService.storeTranscriptEmbeddings(meetingId, processedTranscripts);
          console.log(`✅ Stored ${transcriptsStored} transcripts with embeddings`);
        } catch (transcriptError) {
          console.error('Error storing transcripts with embeddings:', transcriptError);
          // Don't fail the whole request if transcript storage fails, but log it clearly
          transcriptsStored = 0;
          console.log(`⚠️ Meeting ended successfully but transcript embeddings failed to store`);
        }
      }

      // Generate summary if we have transcripts (background process)
      let summaryGenerated = false;
      let emailsSent = false;
      if (transcriptsStored > 0) {
        try {
          console.log(`🤖 Generating AI summary...`);
          
          // Get the updated meeting with transcripts
          const updatedMeeting = await dbService.getMeetingById(meetingId);
          
          if (updatedMeeting && updatedMeeting.transcripts.length > 0) {
            // Generate summary using Claude AI
            const summary = await generateMeetingSummary(
              updatedMeeting.type,
              updatedMeeting.transcripts,
              participants
            );

            // Update meeting with summary
            await dbService.updateMeeting(meetingId, { summary });
            summaryGenerated = true;
            console.log(`✅ Generated and stored AI summary`);

            // Send summary emails to participants if summary was generated successfully
            if (summaryGenerated && participants.length > 0) {
              try {
                console.log(`📧 Sending summary emails to ${participants.length} participants...`);
                
                // Get the final updated meeting with summary
                const meetingWithSummary = await dbService.getMeetingById(meetingId);
                
                if (meetingWithSummary && meetingWithSummary.summary) {
                  // Get room info for email context
                  const room = await dbService.getMeetingRoomByName(roomName);
                  const roomTitle = room?.title || meeting.type || roomName;
                  
                  // Format participants for email service - Get emails from room participants
                  let emailParticipants: Array<{name: string, email: string}> = [];
                  
                  if (room && room.participants && room.participants.length > 0) {
                    // Use participants from the room database with proper email addresses
                    emailParticipants = room.participants
                      .filter((p: any) => p.email && p.email.includes('@'))
                      .map((p: any) => ({
                        name: p.name || 'Participant',
                        email: p.email
                      }));
                  } else {
                    // Fallback: Try to use participants from the request, but they likely won't have emails
                    emailParticipants = participants
                      .filter((p: any) => p.name && typeof p.name === 'string')
                      .map((p: any) => ({
                        name: p.name,
                        email: p.email || `${p.name.toLowerCase().replace(/\s+/g, '.')}@example.com`
                      }))
                      .filter((p: {name: string, email: string}) => p.email && p.email.includes('@') && !p.email.includes('@example.com')); // Only real emails
                  }
                  
                  if (emailParticipants.length > 0) {
                    const emailService = EmailService.getInstance();
                    const emailResult = await emailService.sendMeetingSummary(
                      meetingWithSummary,
                      roomTitle,
                      emailParticipants
                    );
                    
                    if (emailResult.success) {
                      emailsSent = true;
                      console.log(`✅ Summary emails sent to: ${emailResult.sentTo.join(', ')}`);
                    } else {
                      console.log(`⚠️ Some summary emails failed. Sent to: ${emailResult.sentTo.join(', ')}, Failed: ${emailResult.failedTo.join(', ')}`);
                      console.log(`📧 Email errors: ${emailResult.errors.join(', ')}`);
                    }
                  } else {
                    console.log(`⚠️ No valid email addresses found for participants, skipping email sending`);
                  }
                } else {
                  console.log(`⚠️ Summary not found after storage, skipping email sending`);
                }
              } catch (emailError) {
                console.error('Error sending summary emails:', emailError);
                // Don't fail the whole request if email sending fails
              }
            }
          }
        } catch (summaryError) {
          console.error('Error generating summary:', summaryError);
          // Don't fail the whole request if summary generation fails
        }
      }

      console.log(`🎉 Meeting ended successfully: ${meeting.title || meeting.type}`);

      return NextResponse.json({
        success: true,
        message: 'Meeting ended successfully',
        data: {
          meetingId,
          roomName,
          endedAt: meetingEndedAt.toISOString(),
          duration: calculatedDuration,
          transcriptsStored,
          summaryGenerated,
          emailsSent,
          redirectUrl: meeting.roomId 
            ? `/meetingroom/${roomName}` 
            : '/'
        }
      });
    });

  } catch (error) {
    console.error('Error ending meeting:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to end meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to generate meeting summary using Claude AI
async function generateMeetingSummary(
  meetingType: string,
  transcripts: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
    // Enhanced fields for speaker diarization
    speakerConfidence?: number;
    deepgramSpeaker?: number;
    participantId?: string;
    isLocal?: boolean;
  }>,
  participants: Array<{ name: string; isHost?: boolean }>
): Promise<{
  content: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: Date;
}> {
  try {
    // Deduplicate and clean transcripts
    const cleanedTranscripts = deduplicateTranscripts(transcripts);
    console.log(`🧹 Cleaned transcripts: ${transcripts.length} → ${cleanedTranscripts.length}`);

    // Format transcripts for AI analysis with timestamps
    const transcriptText = cleanedTranscripts
      .map(t => {
        const timeStr = t.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `[${timeStr}] ${t.speaker}: ${t.text.trim()}`;
      })
      .join('\n');

    const participantNames = participants.map(p => p.name).join(', ');
    
    // Skip AI processing if transcript is too short or empty
    if (transcriptText.length < 50) {
      console.log('⚠️ Transcript too short for AI analysis, using fallback summary');
      return {
        content: `${meetingType} session with ${participants.length} participants. Brief discussion recorded.`,
        keyPoints: [
          'Short meeting session completed',
          'Basic conversation recorded'
        ],
        actionItems: [
          'Review brief transcript for any follow-ups'
        ],
        decisions: [
          'Meeting completed successfully'
        ],
        generatedAt: new Date()
      };
    }

    console.log(`🤖 Sending ${transcriptText.length} characters to Claude for analysis`);

    // Create structured prompt using Claude's best practices for JSON mode
    const systemPrompt = `You are a meeting analysis AI that generates structured summaries. You must analyze meeting transcripts and return ONLY a valid JSON object with no additional text.

Your response must be a JSON object with these exact keys:
- content: string (2-3 sentence summary of the meeting)
- keyPoints: array of 3-5 strings (main discussion topics)
- actionItems: array of strings (specific tasks identified)
- decisions: array of strings (clear decisions made)

Focus on actionable insights and important information participants need to reference.`;

    const userPrompt = `Analyze this ${meetingType} transcript and generate a summary:

Meeting Type: ${meetingType}
Participants: ${participantNames}
Duration: ${Math.round((cleanedTranscripts[cleanedTranscripts.length - 1]?.timestamp.getTime() - cleanedTranscripts[0]?.timestamp.getTime()) / (1000 * 60)) || 30} minutes

Transcript:
${transcriptText}

Return only valid JSON, no other text.`;

    // Use Claude with proper JSON formatting and prefill
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.1, // Lower temperature for more consistent JSON
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
        {
          role: 'assistant',
          content: '{'  // Prefill to ensure JSON format
        }
      ],
    });

    // Extract response text and prepend the opening brace
    let aiResponse = '{';
    for (const content of response.content) {
      if (content.type === 'text') {
        aiResponse += content.text;
      }
    }

    console.log(`🤖 Claude response length: ${aiResponse.length} characters`);
    
    // Clean up the response - remove any non-JSON content
    const jsonStart = aiResponse.indexOf('{');
    const jsonEnd = aiResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      aiResponse = aiResponse.substring(jsonStart, jsonEnd + 1);
    }

    // Parse the JSON response
    try {
      const parsedResponse = JSON.parse(aiResponse);
      console.log(`✅ Successfully parsed Claude response with ${parsedResponse.keyPoints?.length || 0} key points`);
      
      // Validate response structure
      const validatedResponse = {
        content: typeof parsedResponse.content === 'string' ? parsedResponse.content : 'Meeting summary generated.',
        keyPoints: Array.isArray(parsedResponse.keyPoints) ? parsedResponse.keyPoints : ['Meeting completed successfully'],
        actionItems: Array.isArray(parsedResponse.actionItems) ? parsedResponse.actionItems : ['Review meeting content'],
        decisions: Array.isArray(parsedResponse.decisions) ? parsedResponse.decisions : ['Meeting summary generated'],
        generatedAt: new Date()
      };

      return validatedResponse;
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('Raw AI response:', aiResponse);
      
      // Enhanced fallback with basic analysis
      const speakersCount = new Set(cleanedTranscripts.map(t => t.speaker)).size;
      const totalWords = cleanedTranscripts.reduce((acc, t) => acc + t.text.split(' ').length, 0);
      const avgWordsPerMinute = Math.round(totalWords / Math.max(1, Math.round((cleanedTranscripts[cleanedTranscripts.length - 1]?.timestamp.getTime() - cleanedTranscripts[0]?.timestamp.getTime()) / (1000 * 60))));
      
      return {
        content: `${meetingType} session with ${speakersCount} active participants. Discussion covered ${totalWords} words across ${cleanedTranscripts.length} exchanges. Meeting maintained good engagement with ${avgWordsPerMinute} words per minute.`,
        keyPoints: [
          `${speakersCount} participants actively engaged`,
          `Meeting type: ${meetingType}`,
          `Total discussion: ${cleanedTranscripts.length} exchanges`,
          'Meeting completed successfully'
        ],
        actionItems: [
          'Review detailed transcript for specific action items',
          'Follow up on discussion points mentioned',
          'Share summary with relevant stakeholders'
        ],
        decisions: [
          'Meeting summary generated from transcript analysis',
          'Transcripts stored for future reference'
        ],
        generatedAt: new Date()
      };
    }

  } catch (error) {
    console.error('Error generating AI summary:', error);
    
    // Final fallback if everything fails
    const participantCount = participants.length;
    const duration = Math.round(
      (transcripts[transcripts.length - 1]?.timestamp.getTime() - 
       transcripts[0]?.timestamp.getTime()) / (1000 * 60)
    ) || 30;

    return {
      content: `${meetingType} session with ${participantCount} participants lasting ${duration} minutes. Meeting transcripts were recorded and are available for review.`,
      keyPoints: [
        'Meeting completed successfully',
        'Transcripts recorded and processed',
        'All participants engaged in discussion'
      ],
      actionItems: [
        'Review meeting transcripts',
        'Follow up on discussed topics',
        'Share summary with relevant stakeholders'
      ],
      decisions: [
        'Meeting summary generated',
        'Transcripts stored for future reference'
      ],
      generatedAt: new Date()
    };
  }
} 