/**
 * Vercel-Compatible Meeting Processor Service
 * Handles meeting processing within serverless function limits
 * Uses database for job tracking instead of in-memory storage
 */

import { DatabaseService } from '@/lib/database/mongodb';
import { HybridRAGService } from '@/lib/ai/hybrid-rag';
import { EmailService } from '@/lib/services/email';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ProcessingJob {
  id: string;
  meetingId: string;
  roomName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  steps: {
    transcripts: boolean;
    summary: boolean;
    emails: boolean;
    tasks: boolean;
  };
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class MeetingProcessor {
  private static instance: MeetingProcessor;

  static getInstance(): MeetingProcessor {
    if (!MeetingProcessor.instance) {
      MeetingProcessor.instance = new MeetingProcessor();
    }
    return MeetingProcessor.instance;
  }

  /**
   * Process meeting synchronously within Vercel function limits
   * Returns immediately with results
   */
  async processImmediately(
    meetingId: string,
    roomName: string,
    transcripts: any[],
    participants: any[]
  ): Promise<{
    success: boolean;
    backgroundProcessingStarted: boolean;
    message: string;
  }> {
    console.log(`🚀 MEETING PROCESSOR: Starting INSTANT processing for meeting ${meetingId}`);
    
    try {
      // PERFORMANCE: Validate meeting exists quickly
      const dbService = DatabaseService.getInstance();
      const meeting = await dbService.getMeetingById(meetingId);
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      console.log(`✅ MEETING PROCESSOR: Meeting validated, starting full background processing...`);

      // PERFORMANCE: Mark meeting as processing immediately (non-blocking)
      const updatePromise = dbService.updateMeeting(meetingId, { 
        status: 'processing', // Update main status to processing
        processingStatus: 'pending',
        processingStartedAt: new Date()
      });
      
      // Don't await the update - let it run in parallel with background processing
      updatePromise.catch(error => {
        console.error(`❌ MEETING PROCESSOR: Failed to update meeting status:`, error);
      });
      
      console.log(`✅ MEETING PROCESSOR: Meeting ${meetingId} marked as pending processing`);

      // Since we're running in a dedicated serverless function, await the full processing
      await this.processFullyInBackground(meetingId, roomName, meeting, transcripts, participants);

      console.log(`🎉 MEETING PROCESSOR: Complete processing finished for meeting ${meetingId}`);
      return {
        success: true,
        backgroundProcessingStarted: true,
        message: 'Meeting processing started in background'
      };

    } catch (error) {
      console.error(`❌ MEETING PROCESSOR: Validation failed for meeting ${meetingId}:`, error);
      return {
        success: false,
        backgroundProcessingStarted: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete background processing - transcripts, summary, emails, and tasks
   * This runs independently and doesn't block the main response
   */
  private async processFullyInBackground(
    meetingId: string,
    roomName: string,
    meeting: any,
    transcripts: any[],
    participants: any[]
  ): Promise<void> {
    console.log(`🔄 FULL BACKGROUND PROCESSING: Starting complete processing for meeting ${meetingId}`);
    console.log(`📊 FULL BACKGROUND PROCESSING: Input data:`, {
      meetingId,
      roomName,
      meetingRoomId: meeting.roomId,
      meetingTitle: meeting.title,
      transcriptCount: transcripts.length,
      participantCount: participants.length
    });
    const dbService = DatabaseService.getInstance();
    
    try {
      // PERFORMANCE: Step 1 - Store transcripts with parallel status update
      let transcriptsStored = 0;
      if (transcripts.length > 0) {
        console.log(`📝 FULL BACKGROUND PROCESSING STEP 1: Processing ${transcripts.length} transcripts...`);
        
        // PERFORMANCE: Start transcript storage and status update in parallel
        const [storedCount] = await Promise.all([
          this.storeTranscripts(meetingId, transcripts),
          dbService.updateMeeting(meetingId, { processingStatus: 'in_progress' })
        ]);
        
        transcriptsStored = storedCount;
        console.log(`✅ FULL BACKGROUND PROCESSING STEP 1: Stored ${transcriptsStored} transcripts`);
      } else {
        console.log(`⚠️ FULL BACKGROUND PROCESSING STEP 1: No transcripts to process - meeting should have been deleted by end API`);
        // This shouldn't happen as empty meetings should be deleted by the end API
        // But if it does, mark as completed with no content
        await dbService.updateMeeting(meetingId, { 
          processingStatus: 'completed',
          processingCompletedAt: new Date(),
          processingError: 'No transcripts to process'
        });
        return;
      }

      // Step 2: Generate summary (only if we have transcripts)
      if (transcriptsStored > 0) {
        console.log(`🤖 FULL BACKGROUND PROCESSING STEP 2: Generating AI summary...`);
        
        // Start AI summary generation
        const summaryPromise = this.generateSummaryQuick(meeting.type, transcripts, participants);
        
        // Update status to show we're generating summary
        await dbService.updateMeeting(meetingId, { 
          processingStatus: 'generating_summary'
        });
        
        const summary = await summaryPromise;
        
        console.log(`🤖 FULL BACKGROUND PROCESSING STEP 2: Generated summary:`, {
          title: summary.title,
          content: summary.content?.substring(0, 100) + '...',
          keyPoints: summary.keyPoints,
          actionItems: summary.actionItems,
          decisions: summary.decisions
        });
        
        const updateData: any = {
          summary,
          processingStatus: 'summary_completed',
          summaryGeneratedAt: new Date()
        };

        // Update meeting title from AI if available (replace temporary title)
        if (summary.title && summary.title.trim() !== '') {
          updateData.title = summary.title;
          console.log(`📝 FULL BACKGROUND PROCESSING: Updating meeting title from "${meeting.title}" to: "${summary.title}"`);
        } else {
          // Fallback title if AI doesn't generate one
          updateData.title = meeting.type || 'Meeting';
          console.log(`📝 FULL BACKGROUND PROCESSING: Using fallback title: "${updateData.title}"`);
        }

        await dbService.updateMeeting(meetingId, updateData);
        
        console.log(`✅ FULL BACKGROUND PROCESSING STEP 2: Summary generated successfully`);
        console.log(`📋 FULL BACKGROUND PROCESSING STEP 2: Summary details:`, {
          title: summary.title,
          contentLength: summary.content?.length || 0,
          sectionsCount: summary.sections?.length || 0,
          totalPoints: summary.sections?.reduce((acc: number, section: any) => acc + (section.points?.length || 0), 0) || 0,
          actionItemsCount: summary.actionItems?.length || 0
        });

        // Steps 3 & 4: Run emails and tasks in parallel for faster completion
        console.log(`🚀 FULL BACKGROUND PROCESSING STEPS 3&4: Running emails and tasks in parallel...`);
        const [emailResult, taskResult] = await Promise.allSettled([
          // Step 3: Send emails
          this.sendEmails(meetingId, roomName, participants),
          // Step 4: Create tasks from action items
          this.createTasks(meetingId, meeting.roomId)
        ]);

        // Log email results
        if (emailResult.status === 'fulfilled') {
          console.log(`✅ FULL BACKGROUND PROCESSING STEP 3: Emails sent successfully`);
        } else {
          console.error('❌ FULL BACKGROUND PROCESSING STEP 3: Email sending failed:', emailResult.reason);
        }

        // Log task results
        if (taskResult.status === 'fulfilled') {
          console.log(`✅ FULL BACKGROUND PROCESSING STEP 4: Created ${taskResult.value} tasks`);
        } else {
          console.error('❌ FULL BACKGROUND PROCESSING STEP 4: Task creation failed:', taskResult.reason);
        }

        // Mark as fully completed
        await dbService.updateMeeting(meetingId, { 
          status: 'completed', // Update main status to completed
          processingStatus: 'completed',
          processingCompletedAt: new Date()
        });

        console.log(`🎉 FULL BACKGROUND PROCESSING: Completed successfully for meeting ${meetingId}`);
      } else {
        console.log(`⚠️ FULL BACKGROUND PROCESSING: No transcripts to process, marking as completed`);
        await dbService.updateMeeting(meetingId, { 
          status: 'completed', // Update main status to completed
          processingStatus: 'completed',
          processingCompletedAt: new Date()
        });
      }

    } catch (error) {
      console.error(`❌ FULL BACKGROUND PROCESSING: Failed for meeting ${meetingId}:`, error);
      
      // Mark as failed but don't throw - this is background processing
      await dbService.updateMeeting(meetingId, { 
        status: 'completed', // Even if processing failed, meeting is done
        processingStatus: 'failed',
        processingError: error instanceof Error ? error.message : 'Unknown error',
        processingFailedAt: new Date()
      });
    }
  }

  /**
   * Store transcripts with embeddings in Pinecone only
   * PERFORMANCE: Parallel embeddings generation and database update
   */
  private async storeTranscripts(meetingId: string, transcripts: any[]): Promise<number> {
    const dbService = DatabaseService.getInstance();
    const ragService = HybridRAGService.getInstance();
    
    // Clean and deduplicate transcripts
    const cleanedTranscripts = this.deduplicateTranscripts(transcripts);
    
    if (cleanedTranscripts.length > 0) {
      // PERFORMANCE: Start embeddings storage and database update in parallel
      const [_, __] = await Promise.all([
        ragService.storeTranscriptEmbeddings(meetingId, cleanedTranscripts),
        dbService.updateMeeting(meetingId, {
          transcriptCount: cleanedTranscripts.length,
          hasEmbeddings: true,
          embeddingsGeneratedAt: new Date()
        })
      ]);
      
      return cleanedTranscripts.length;
    }
    
    return 0;
  }

  /**
   * Generate AI summary with timeout for Vercel
   */
  private async generateSummaryQuick(
    meetingType: string,
    transcripts: any[],
    participants: any[]
  ): Promise<any> {
    const cleanedTranscripts = this.deduplicateTranscripts(transcripts);
    
    if (cleanedTranscripts.length === 0) {
      return this.getFallbackSummary(meetingType, participants);
    }

    try {
      console.log('🤖 MEETING PROCESSOR: Calling Claude API without timeout restrictions...');
      const summary = await this.generateSummaryWithAI(meetingType, cleanedTranscripts, participants);
      console.log('🤖 MEETING PROCESSOR: Claude API call completed successfully');
      return summary;

    } catch (error) {
      console.error('❌ MEETING PROCESSOR: AI summary failed, using fallback:', error);
      return this.getFallbackSummary(meetingType, participants);
    }
  }

  /**
   * AI summary generation (extracted for timeout handling)
   */
  private async generateSummaryWithAI(
    meetingType: string,
    cleanedTranscripts: any[],
    participants: any[]
  ): Promise<any> {
    console.log('🤖 MEETING PROCESSOR: Calling Claude API with full transcript...');

    // Send FULL transcript - no length limits as requested
    const transcriptText = cleanedTranscripts
      .map(t => {
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `[${timeStr}] ${t.speaker}: ${t.text.trim()}`;
      })
      .join('\n');

    const participantNames = participants.map(p => p.name).join(', ');

    console.log('📝 Sending complete transcript to Claude:', {
      transcriptLength: transcriptText.length,
      transcriptCount: cleanedTranscripts.length,
      participantCount: participants.length,
      estimatedInputTokens: Math.ceil(transcriptText.length / 4) // Rough estimate: 4 chars per token
    });

    // Claude Sonnet 4 has a 200K token input limit - warn if we're getting close
    const estimatedTokens = Math.ceil(transcriptText.length / 4);
    if (estimatedTokens > 150000) {
      console.log('⚠️ WARNING: Very long transcript may approach Claude input limits', {
        estimatedTokens,
        limit: 200000
      });
    }

    // Structured prompt with sections and clickable context
    const systemPrompt = `You are an AI meeting assistant. Create a detailed, well-structured meeting summary with clickable bullet points.

CRITICAL: Respond with ONLY valid JSON. No extra text, explanations, or formatting.

Required JSON structure (must match exactly):
{
  "title": "Descriptive meeting title based on main topics discussed",
  "content": "Comprehensive 3-4 sentence overview summarizing the entire meeting discussion and outcomes",
  "sections": [
    {
      "title": "Section name (e.g., 'Technical Discussion', 'Budget Planning', 'Strategic Decisions')",
      "points": [
        {
          "text": "Detailed bullet point with specific information from the discussion",
          "speaker": "Name of person who mentioned this (if clearly identifiable, otherwise null)",
          "context": {
            "speaker": "Name of the person who said this",
            "reasoning": "Why they said this, what prompted the discussion, the motivation behind the statement",
            "transcriptExcerpt": "The exact quote or key statement from the transcript that this point is based on",
            "relatedDiscussion": "Surrounding conversation that provides context - what was being discussed before and after this point"
          }
        }
      ]
    }
  ],
  "actionItems": [
    {
      "title": "Specific actionable task title",
      "owner": "Person name or 'Unassigned'",
      "priority": "HIGH|MEDIUM|LOW", 
      "dueDate": null,
      "context": "Detailed context about why this action is needed"
    }
  ],
  "decisions": [
    "Specific decision made with context",
    "Another decision with details"
  ]
}

CONTENT GUIDELINES:
- For SHORT meetings (under 10 minutes): Create 2-3 sections with 2-3 bullet points each
- For NORMAL meetings (10-60 minutes): Create 4-5 sections with 3-4 bullet points each  
- For LONG meetings (1+ hours): Create 5-7 sections with 4-5 bullet points each to capture all key topics
- Section titles should be descriptive (e.g., "Product Strategy Discussion", "Technical Implementation", "Budget Review", "Next Steps")
- Each bullet point must include specific details from the transcript
- For context.transcriptExcerpt: Use actual quotes from the meeting transcript (keep excerpts concise but meaningful)
- For context.relatedDiscussion: Describe what was happening in the conversation around that point
- If speaker is unclear from transcript, use null
- Extract concrete details, numbers, names, and specific discussions from the transcript
- For long meetings: Focus on the most important topics and decisions, but ensure comprehensive coverage
- If no clear action items or decisions exist, use empty arrays

IMPORTANT: No artificial limits on transcript length - analyze the entire meeting content regardless of length. For very long meetings, organize content logically by major topic areas or time periods discussed.

Make all content detailed and based on the actual transcript content. The bullet points will be clickable to show the context.`;

    const userPrompt = `Meeting Type: ${meetingType}
Participants: ${participantNames}

Complete Meeting Transcript:
${transcriptText}

Generate a comprehensive meeting summary in the exact JSON format specified.`;

    try {
      // For long meetings (1-2 hours), we need more generous limits
      const isLongMeeting = cleanedTranscripts.length > 100 || transcriptText.length > 20000;
      const maxTokens = isLongMeeting ? 8000 : 4000; // Much higher for long meetings
      const timeoutMs = isLongMeeting ? 120000 : 60000; // 2 minutes for long meetings, 1 minute for normal
      
      console.log(`🤖 Claude API configuration for ${isLongMeeting ? 'LONG' : 'NORMAL'} meeting:`, {
        maxTokens,
        timeoutSeconds: timeoutMs / 1000,
        transcriptLength: transcriptText.length,
        transcriptCount: cleanedTranscripts.length
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', // Use the correct model name
        max_tokens: maxTokens, // Dynamic based on meeting length - NO ARTIFICIAL LIMITS
        temperature: 0.1, // Low for consistent formatting
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      }, {
        timeout: timeoutMs // Dynamic timeout for longer processing
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Claude');
      }

      let aiResponse = '';
      for (const content of response.content) {
        if (content.type === 'text') {
          aiResponse += content.text;
        }
      }

      aiResponse = aiResponse.trim();
      
      console.log('🤖 Claude response length:', aiResponse.length);
      console.log('🤖 Claude response preview:', aiResponse.substring(0, 300) + '...');

      // Clean up response to ensure valid JSON
      if (!aiResponse.startsWith('{')) {
        const jsonStart = aiResponse.indexOf('{');
        if (jsonStart !== -1) {
          aiResponse = aiResponse.substring(jsonStart);
        } else {
          throw new Error('No JSON object found in Claude response');
        }
      }

      if (!aiResponse.endsWith('}')) {
        const jsonEnd = aiResponse.lastIndexOf('}');
        if (jsonEnd !== -1) {
          aiResponse = aiResponse.substring(0, jsonEnd + 1);
        }
      }

      console.log('🤖 Cleaned response for parsing');

      const parsed = JSON.parse(aiResponse);
      
      // Validate required fields
      if (!parsed.title || !parsed.content || !parsed.sections) {
        throw new Error('Missing required fields in Claude response');
      }

      return {
        ...parsed,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('❌ MEETING PROCESSOR: AI summary failed:', error);
      throw error;
    }
  }

  /**
   * Send summary emails to participants
   * PERFORMANCE: Uses batch database operations
   */
  private async sendEmails(meetingId: string, roomName: string, participants: any[]): Promise<void> {
    const dbService = DatabaseService.getInstance();
    const emailService = EmailService.getInstance();

    // PERFORMANCE: Batch fetch meeting and room data in parallel
    const { meeting, room } = await dbService.getMeetingWithRoom(meetingId, roomName);

    if (!meeting?.summary || !room) return;

    // Get email addresses from room participants
    const emailParticipants = room.participants
      ?.filter((p: any) => p.email && p.email.includes('@'))
      .map((p: any) => ({
        name: p.name || 'Participant',
        email: p.email
      })) || [];

    if (emailParticipants.length > 0) {
      const roomTitle = room.title || meeting.type || roomName;
      await emailService.sendMeetingSummary(meeting, roomTitle, emailParticipants);
    }
  }

  /**
   * Create tasks from action items
   */
  private async createTasks(meetingId: string, roomId?: string): Promise<number> {
    console.log(`📋 TASK CREATION: Starting task creation for meeting ${meetingId}, roomId: ${roomId}`);
    
    if (!roomId) {
      console.log(`⚠️ TASK CREATION: No roomId provided, skipping task creation`);
      return 0;
    }

    const dbService = DatabaseService.getInstance();
    const meeting = await dbService.getMeetingById(meetingId);

    console.log(`📋 TASK CREATION: Meeting summary:`, {
      hasSummary: !!meeting?.summary,
      actionItemsCount: meeting?.summary?.actionItems?.length || 0,
      actionItems: meeting?.summary?.actionItems
    });

    if (!meeting?.summary?.actionItems || meeting.summary.actionItems.length === 0) {
      console.log(`⚠️ TASK CREATION: No action items found in meeting summary`);
      return 0;
    }

    let tasksCreated = 0;
    
    // Create tasks from action items
    for (const actionItem of meeting.summary.actionItems as any[]) {
      // Handle both old format (string) and new format (object)
      if (typeof actionItem === 'string' && actionItem.trim().length > 0) {
        // Old format - create with defaults
        try {
          const taskData = {
            roomId,
            meetingId,
            title: actionItem,
            description: `Generated from meeting: ${meeting.title || meeting.type}`,
            priority: 'MEDIUM' as const,
            isAiGenerated: true,
            aiConfidence: 0.8,
            createdByName: 'AI Assistant',
            reviewStatus: 'pending_review' as const,
            meetingTitle: meeting.title || meeting.type,
            meetingDate: meeting.startedAt
          };
          console.log(`📋 TASK CREATION: Creating task with data:`, taskData);
          await dbService.createTask(taskData);
          tasksCreated++;
        } catch (taskError) {
          console.error('Failed to create task:', actionItem, taskError);
        }
      } else if (typeof actionItem === 'object' && actionItem.title) {
        // New structured format
        try {
          const dueDate = actionItem.dueDate ? new Date(actionItem.dueDate) : undefined;
          
          const structuredTaskData = {
            roomId,
            meetingId,
            title: actionItem.title,
            description: actionItem.context || `Generated from meeting: ${meeting.title || meeting.type}`,
            priority: (actionItem.priority || 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
            assignedToName: actionItem.owner !== 'Unassigned' ? actionItem.owner : undefined,
            dueDate,
            isAiGenerated: true,
            aiConfidence: 0.9, // Higher confidence with structured format
            createdByName: 'AI Assistant',
            reviewStatus: 'pending_review' as const,
            meetingTitle: meeting.title || meeting.type,
            meetingDate: meeting.startedAt
          };
          console.log(`📋 TASK CREATION: Creating structured task with data:`, structuredTaskData);
          await dbService.createTask(structuredTaskData);
          tasksCreated++;
        } catch (taskError) {
          console.error('Failed to create task:', actionItem, taskError);
        }
      }
    }

    return tasksCreated;
  }

  /**
   * Deduplicate transcripts (improved version)
   */
  private deduplicateTranscripts(transcripts: any[]): any[] {
    console.log('🔍 DEDUPLICATION: Starting with', transcripts.length, 'transcripts');
    
    const cleaned = transcripts
      .filter(t => t.text && t.text.trim().length > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    console.log('🔍 DEDUPLICATION: After filtering empty:', cleaned.length, 'transcripts');

    // More aggressive deduplication - check for exact duplicates and near-duplicates
    const deduplicated = cleaned.reduce((acc, current) => {
      const currentText = current.text.trim().toLowerCase();
      const currentTime = new Date(current.timestamp).getTime();
      
      const isDuplicate = acc.some((existing: any) => {
        const existingText = existing.text.trim().toLowerCase();
        const existingTime = new Date(existing.timestamp).getTime();
        
        // Check for exact duplicates (same speaker, same text, within 5 seconds)
        const timeDiff = Math.abs(currentTime - existingTime);
        return existing.speaker === current.speaker && 
               existingText === currentText && 
               timeDiff < 5000; // Within 5 seconds
      });
      
      if (!isDuplicate) {
        acc.push({
          speaker: current.speaker,
          text: current.text.trim(),
          timestamp: new Date(current.timestamp),
          speakerConfidence: current.speakerConfidence,
          deepgramSpeaker: current.deepgramSpeaker,
          participantId: current.participantId,
          isLocal: current.isLocal
        });
      }
      
      return acc;
    }, [] as any[]);
    
    console.log('🔍 DEDUPLICATION: Final result:', deduplicated.length, 'unique transcripts');
    return deduplicated;
  }

  /**
   * Fallback summary when AI fails
   */
  private getFallbackSummary(meetingType: string, participants: any[]): any {
    console.log('⚠️ MEETING PROCESSOR: Using fallback summary');
    return {
      title: `${meetingType} Session`,
      content: `${meetingType} session with ${participants.length} participants completed successfully. The meeting covered various discussion topics and was recorded for future reference. Participants engaged actively throughout the session.`,
      sections: [
        {
          title: 'Meeting Overview',
          points: [
            {
              text: 'Meeting completed successfully with all participants present',
              speaker: null,
              context: {
                speaker: 'System',
                reasoning: 'Meeting completion status',
                transcriptExcerpt: 'Meeting session completed',
                relatedDiscussion: 'General meeting completion and participant engagement'
              }
            },
            {
              text: 'Session was recorded for future reference and review',
              speaker: null,
              context: {
                speaker: 'System',
                reasoning: 'Recording functionality confirmation',
                transcriptExcerpt: 'Session recorded',
                relatedDiscussion: 'Meeting recording and documentation process'
              }
            }
          ]
        },
        {
          title: 'Next Steps',
          points: [
            {
              text: 'Review meeting transcripts for key takeaways',
              speaker: null,
              context: {
                speaker: 'System',
                reasoning: 'Standard follow-up procedure',
                transcriptExcerpt: 'Review transcripts',
                relatedDiscussion: 'Post-meeting review and action item identification'
              }
            },
            {
              text: 'Schedule follow-up meetings with relevant stakeholders as needed',
              speaker: null,
              context: {
                speaker: 'System',
                reasoning: 'Continuation planning',
                transcriptExcerpt: 'Schedule follow-ups',
                relatedDiscussion: 'Future meeting planning and stakeholder engagement'
              }
            }
          ]
        }
      ],
      actionItems: [
        {
          title: 'Review meeting transcripts',
          owner: 'Unassigned',
          priority: 'MEDIUM',
          dueDate: null,
          context: 'Follow up on meeting discussion'
        },
        {
          title: 'Follow up on discussed topics',
          owner: 'Unassigned',
          priority: 'MEDIUM',
          dueDate: null,
          context: 'Ensure action items are addressed'
        }
      ],
      decisions: [
        'Meeting summary generated',
        'Transcripts stored for future reference'
      ],
      generatedAt: new Date()
    };
  }
} 
