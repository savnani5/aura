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
      // Validate meeting exists quickly
      const dbService = DatabaseService.getInstance();
      const meeting = await dbService.getMeetingById(meetingId);
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      console.log(`✅ MEETING PROCESSOR: Meeting validated, starting full background processing...`);

      // Mark meeting as processing immediately
      await dbService.updateMeeting(meetingId, { 
        status: 'processing', // Update main status to processing
        processingStatus: 'pending',
        processingStartedAt: new Date()
      });
      
      console.log(`✅ MEETING PROCESSOR: Meeting ${meetingId} marked as pending processing`);

      // Start COMPLETE background processing without waiting for anything
      this.processFullyInBackground(meetingId, roomName, meeting, transcripts, participants)
        .catch((error: any) => {
          console.error(`❌ FULL BACKGROUND PROCESSING: Failed for meeting ${meetingId}:`, error);
        });

      // Return immediately - user doesn't wait for anything!
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
      // Step 1: Store transcripts and embeddings
      let transcriptsStored = 0;
      if (transcripts.length > 0) {
        console.log(`📝 FULL BACKGROUND PROCESSING STEP 1: Processing ${transcripts.length} transcripts...`);
        transcriptsStored = await this.storeTranscripts(meetingId, transcripts);
        console.log(`✅ FULL BACKGROUND PROCESSING STEP 1: Stored ${transcriptsStored} transcripts`);
        
        // Mark as in progress after transcripts are stored
        await dbService.updateMeeting(meetingId, { 
          processingStatus: 'in_progress'
        });
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
        const summary = await this.generateSummaryQuick(meeting.type, transcripts, participants);
        
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
          keyPointsCount: summary.keyPoints?.length || 0,
          actionItemsCount: summary.actionItems?.length || 0
        });

        // Step 3: Send emails (only after summary is ready)
        console.log(`📧 FULL BACKGROUND PROCESSING STEP 3: Sending emails...`);
        try {
          await this.sendEmails(meetingId, roomName, participants);
          console.log(`✅ FULL BACKGROUND PROCESSING STEP 3: Emails sent successfully`);
        } catch (emailError) {
          console.error('❌ FULL BACKGROUND PROCESSING STEP 3: Email sending failed:', emailError);
        }

        // Step 4: Create tasks from action items (only after summary is ready)
        console.log(`📋 FULL BACKGROUND PROCESSING STEP 4: Creating tasks from action items...`);
        console.log(`📋 FULL BACKGROUND PROCESSING STEP 4: Action items to process:`, JSON.stringify(summary.actionItems, null, 2));
        try {
          const tasksCreated = await this.createTasks(meetingId, meeting.roomId);
          console.log(`✅ FULL BACKGROUND PROCESSING STEP 4: Created ${tasksCreated} tasks`);
        } catch (taskError) {
          console.error('❌ FULL BACKGROUND PROCESSING STEP 4: Task creation failed:', taskError);
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
   */
  private async storeTranscripts(meetingId: string, transcripts: any[]): Promise<number> {
    const dbService = DatabaseService.getInstance();
    const ragService = HybridRAGService.getInstance();
    
    // Clean and deduplicate transcripts
    const cleanedTranscripts = this.deduplicateTranscripts(transcripts);
    
    if (cleanedTranscripts.length > 0) {
      // Store embeddings in Pinecone for semantic search and AI context
      await ragService.storeTranscriptEmbeddings(meetingId, cleanedTranscripts);
      
      // Only store metadata in MongoDB (not the full transcripts)
      await dbService.updateMeeting(meetingId, {
        transcriptCount: cleanedTranscripts.length,
        hasEmbeddings: true,
        embeddingsGeneratedAt: new Date()
      });
      
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
    const transcriptText = cleanedTranscripts
      .map(t => {
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `[${timeStr}] ${t.speaker}: ${t.text.trim()}`;
      })
      .join('\n');

    // Limit transcript length for faster processing
    const maxTranscriptLength = 8000; // Reasonable limit for fast processing
    const limitedTranscript = transcriptText.length > maxTranscriptLength 
      ? transcriptText.substring(0, maxTranscriptLength) + '...'
      : transcriptText;

    const participantNames = participants.map(p => p.name).join(', ');

    const systemPrompt = `You are a meeting analysis AI. Analyze the transcript and create detailed meeting notes in JSON format.

ADAPTIVE APPROACH:
- For short meetings (under 10 minutes) or simple conversations: Create a brief summary with 1-2 sections
- For medium meetings (10-30 minutes): Create 2-4 sections with moderate detail
- For long meetings (30+ minutes): Create 3-6+ sections with comprehensive detail
- Let the content and complexity of the discussion drive the structure, not arbitrary limits

REQUIRED JSON STRUCTURE:
- title: concise 4-8 word meeting title based on main topic
- content: 2-3 sentence overall summary
- sections: array of detailed sections based on natural topic flow, including:
  * Discussion topics and key points
  * Action items (if any) as a dedicated section
  * Decisions made (if any) as points within relevant sections
  * Technical details, strategic discussions, etc.
  
  Each section format:
  {
    "title": "descriptive section name (e.g., 'Product Strategy Discussion', 'Action Items & Next Steps')",
    "points": [
             {
         "text": "detailed, substantive bullet point with specific information",
         "speaker": "name of person who mentioned this (if clearly identifiable)",
         "context": {
           "speaker": "name of the person who said this",
           "reasoning": "why they said this, what prompted the discussion, the motivation behind the statement",
           "transcriptExcerpt": "the exact quote or key statement from the transcript",
           "relatedDiscussion": "surrounding conversation that provides context - what was being discussed before and after this point"
         }
       }
    ]
  }

- actionItems: array of actionable tasks extracted from the discussion:
{
  "title": "specific task description", 
  "owner": "person responsible (from participants, or 'Unassigned' if unclear)",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "dueDate": "YYYY-MM-DD format if mentioned, otherwise null",
  "context": "brief context about why this task is needed"
}

- decisions: array of clear decisions made during the meeting

GUIDELINES:
- Include action items both as a dedicated section AND in the actionItems array
- Make bullet points substantive and informative, not just topic names
- Include transcript references for important points - these will be shown in clickable popups
- Focus on capturing substance and details discussed, like comprehensive meeting notes
- For brief meetings, don't force artificial structure - adapt to the content
- Prioritize quality over quantity - better to have fewer, more meaningful sections`;

    const userPrompt = `Meeting Type: ${meetingType}
Participants: ${participantNames}
Transcript: ${limitedTranscript}

Return only valid JSON.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800, // Reduced for faster response
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: '{' }
      ],
    });

    let aiResponse = '{';
    for (const content of response.content) {
      if (content.type === 'text') {
        aiResponse += content.text;
      }
    }

    const parsed = JSON.parse(aiResponse);
    return {
      ...parsed,
      generatedAt: new Date()
    };
  }

  /**
   * Send summary emails to participants
   */
  private async sendEmails(meetingId: string, roomName: string, participants: any[]): Promise<void> {
    const dbService = DatabaseService.getInstance();
    const emailService = EmailService.getInstance();

    const meeting = await dbService.getMeetingById(meetingId);
    const room = await dbService.getMeetingRoomByName(roomName);

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
   * Deduplicate transcripts (simplified version)
   */
  private deduplicateTranscripts(transcripts: any[]): any[] {
    return transcripts
      .filter(t => t.text && t.text.trim().length > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .reduce((acc, current) => {
        const isDuplicate = acc.some((existing: any) => 
          existing.speaker === current.speaker && 
          existing.text.trim() === current.text.trim()
        );
        
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
  }

  /**
   * Fallback summary when AI fails
   */
  private getFallbackSummary(meetingType: string, participants: any[]): any {
    console.log('⚠️ MEETING PROCESSOR: Using fallback summary');
    return {
      title: `${meetingType} Session`,
      content: `${meetingType} session with ${participants.length} participants completed successfully.`,
      keyPoints: [
        'Meeting completed successfully',
        'Participants engaged in discussion',
        'Transcripts recorded for reference'
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
