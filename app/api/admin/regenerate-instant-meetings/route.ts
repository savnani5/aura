import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';
import { EmbeddingsService } from '@/lib/embeddings-service';

// POST /api/admin/regenerate-instant-meetings - Delete all instant meetings and create new ones
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting instant meetings regeneration...');
    
    const db = DatabaseService.getInstance();
    const embeddingsService = EmbeddingsService.getInstance();
    
    // Step 1: Delete all instant meetings (isOneOff: true)
    console.log('🗑️ Deleting all instant meetings...');
    const deleteResult = await db.deleteAllOneOffMeetings();
    console.log(`✅ Deleted ${deleteResult.deletedCount} instant meetings`);
    
    // Step 2: Generate 5 new instant meetings with diverse topics
    const meetingTemplates = [
      {
        title: 'Product Strategy Discussion',
        type: 'Strategy Meeting',
        participants: ['Alex Chen', 'Sarah Johnson', 'Mike Rodriguez'],
        duration: 45,
        transcriptTopics: [
          'product roadmap planning',
          'market analysis discussion',
          'competitive positioning',
          'user feedback review',
          'feature prioritization decisions'
        ]
      },
      {
        title: 'Client Onboarding Review',
        type: 'Client Meeting',
        participants: ['Jennifer Lee', 'David Kim', 'Client - Robert Smith'],
        duration: 35,
        transcriptTopics: [
          'client requirements gathering',
          'project timeline discussion',
          'deliverable expectations',
          'communication protocols',
          'next steps planning'
        ]
      },
      {
        title: 'Team Retrospective',
        type: 'Retrospective',
        participants: ['Emma Davis', 'Tom Wilson', 'Lisa Park', 'James Brown'],
        duration: 55,
        transcriptTopics: [
          'what went well this sprint',
          'areas for improvement',
          'blockers and challenges',
          'team collaboration feedback',
          'action items for next sprint'
        ]
      },
      {
        title: 'Technical Architecture Review',
        type: 'Technical Meeting',
        participants: ['Ryan Zhang', 'Anna Kowalski', 'Carlos Lopez'],
        duration: 60,
        transcriptTopics: [
          'system architecture discussion',
          'scalability concerns',
          'technology stack decisions',
          'integration requirements',
          'performance optimization strategies'
        ]
      },
      {
        title: 'Marketing Campaign Planning',
        type: 'Marketing Meeting',
        participants: ['Sophie Turner', 'Mark Anderson', 'Rachel Green'],
        duration: 40,
        transcriptTopics: [
          'campaign goals and objectives',
          'target audience analysis',
          'marketing channel strategy',
          'budget allocation discussion',
          'timeline and milestones'
        ]
      }
    ];
    
    console.log('📝 Generating new instant meetings with transcripts...');
    const createdMeetings = [];
    
    for (let i = 0; i < meetingTemplates.length; i++) {
      const template = meetingTemplates[i];
      
      // Generate realistic start time (within last 2 weeks)
      const weeksAgo = Math.random() * 2; // 0-2 weeks ago
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - (weeksAgo * 7));
      startedAt.setHours(
        9 + Math.floor(Math.random() * 8), // 9 AM to 5 PM
        Math.floor(Math.random() * 60), // Random minutes
        0,
        0
      );
      
      const endedAt = new Date(startedAt.getTime() + template.duration * 60 * 1000);
      
      // Generate realistic transcripts
      const transcripts = generateMockTranscripts(
        template.participants,
        template.transcriptTopics,
        template.duration,
        startedAt
      );
      
      // Generate embeddings for transcripts
      console.log(`🧠 Generating embeddings for meeting: ${template.title}`);
      const transcriptsWithEmbeddings = [];
      
      for (const transcript of transcripts) {
        const embeddingResult = await embeddingsService.generateTranscriptEmbedding(
          transcript.speaker,
          transcript.text
        );
        
        transcriptsWithEmbeddings.push({
          speaker: transcript.speaker,
          text: transcript.text,
          timestamp: transcript.timestamp,
          embedding: embeddingResult.embedding
        });
      }
      
      // Generate AI summary based on meeting type and transcripts
      console.log(`📄 Generating summary for meeting: ${template.title}`);
      const summary = generateMeetingSummary(template.type, template.transcriptTopics, transcripts);
      
      // Create the instant meeting
      const roomName = `instant-${Date.now()}-${i}`;
      const meeting = await db.createMeeting({
        roomName,
        title: template.title,
        type: template.type,
        isOneOff: true, // This makes it an instant meeting
        startedAt,
        endedAt,
        duration: template.duration,
        participants: template.participants.map((name, idx) => ({
          name,
          joinedAt: startedAt,
          leftAt: endedAt,
          isHost: idx === 0
        })),
        transcripts: transcriptsWithEmbeddings,
        summary: summary,
        isRecording: false
      });
      
      createdMeetings.push(meeting);
      console.log(`✅ Created instant meeting: ${template.title} (${transcripts.length} transcripts)`);
    }
    
    console.log(`🎉 Successfully regenerated ${createdMeetings.length} instant meetings`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully regenerated ${createdMeetings.length} instant meetings`,
      data: {
        deletedCount: deleteResult.deletedCount,
        createdCount: createdMeetings.length,
        meetings: createdMeetings.map(m => ({
          id: m._id,
          title: m.title,
          type: m.type,
          transcriptCount: m.transcripts?.length || 0,
          participantCount: m.participants.length,
          duration: m.duration
        }))
      }
    });
    
  } catch (error) {
    console.error('Error regenerating instant meetings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to regenerate instant meetings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to generate realistic mock transcripts
function generateMockTranscripts(
  participants: string[],
  topics: string[],
  durationMinutes: number,
  startTime: Date
): Array<{
  speaker: string;
  text: string;
  timestamp: Date;
}> {
  const transcripts = [];
  const transcriptCount = Math.floor(durationMinutes / 2) + Math.floor(Math.random() * 10); // 1 transcript per 2 minutes + random
  
  // Template phrases for different topics
  const topicTemplates: Record<string, string[]> = {
    'product roadmap planning': [
      "Let's review our Q4 roadmap priorities",
      "I think we should focus on the user experience improvements first",
      "The analytics feature is getting a lot of customer requests",
      "We need to balance new features with technical debt reduction",
      "What's the timeline looking like for the mobile app updates?"
    ],
    'market analysis discussion': [
      "The competitive landscape has shifted quite a bit recently",
      "Our user acquisition costs have been trending upward",
      "The customer feedback shows strong demand for enterprise features",
      "Market research indicates we're well-positioned in the mid-market segment",
      "Should we consider expanding into the European market next year?"
    ],
    'technical architecture discussion': [
      "The current database schema is starting to show performance bottlenecks",
      "We should consider moving to a microservices architecture",
      "The API response times need optimization, especially for large datasets",
      "Container orchestration would help with our deployment processes",
      "Let's discuss the trade-offs between consistency and availability"
    ],
    'client requirements gathering': [
      "Could you walk us through your current workflow?",
      "What are the main pain points you're experiencing?",
      "How many users would be accessing the system daily?",
      "Are there any compliance requirements we need to consider?",
      "What's your expected timeline for going live?"
    ],
    'team collaboration feedback': [
      "The new code review process is working much better",
      "Communication during the last sprint was really effective",
      "We should continue having these brief daily check-ins",
      "The cross-team collaboration on the integration went smoothly",
      "I think we need better documentation for our APIs"
    ],
    'campaign goals and objectives': [
      "Our primary goal is to increase brand awareness by 30%",
      "Lead generation should be our top priority this quarter",
      "We want to target the 25-40 demographic in urban areas",
      "The budget allocation between digital and traditional media needs review",
      "Customer retention campaigns should run parallel to acquisition efforts"
    ]
  };
  
  // Default templates for generic content
  const defaultTemplates = [
    "Thanks everyone for joining today's meeting",
    "Let me share my screen to show the latest updates",
    "I think that's a great point, let's explore that further",
    "We should follow up on this after the meeting",
    "Does anyone have questions about what we've discussed so far?",
    "Let's make sure we capture these action items",
    "That aligns well with our overall strategy",
    "We'll need to coordinate with the other teams on this",
    "I'll send out a summary after this meeting",
    "What does everyone think about this approach?"
  ];
  
  for (let i = 0; i < transcriptCount; i++) {
    const speaker = participants[Math.floor(Math.random() * participants.length)];
    const minutesElapsed = (i / transcriptCount) * durationMinutes;
    const timestamp = new Date(startTime.getTime() + minutesElapsed * 60 * 1000);
    
    // Choose a topic-specific template or default
    let templates = defaultTemplates;
    if (topics.length > 0) {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      if (topicTemplates[topic]) {
        templates = topicTemplates[topic];
      }
    }
    
    const text = templates[Math.floor(Math.random() * templates.length)];
    
    transcripts.push({
      speaker,
      text,
      timestamp
    });
  }
  
  // Sort by timestamp
  return transcripts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function generateMeetingSummary(
  type: string,
  topics: string[],
  transcripts: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
  }>
): {
  content: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: Date;
} {
  const participantNames = [...new Set(transcripts.map(t => t.speaker))];
  const participantCount = participantNames.length;
  const duration = Math.round((transcripts[transcripts.length - 1]?.timestamp.getTime() - transcripts[0]?.timestamp.getTime()) / (1000 * 60)) || 45;

  // Generate content based on meeting type
  const summaryContent = generateSummaryContent(type, topics, participantCount, duration);
  
  // Generate key points based on topics and type
  const keyPoints = generateKeyPoints(type, topics);
  
  // Generate action items
  const actionItems = generateActionItems(type, topics);
  
  // Generate decisions
  const decisions = generateDecisions(type, topics);

  return {
    content: summaryContent,
    keyPoints,
    actionItems,
    decisions,
    generatedAt: new Date()
  };
}

function generateSummaryContent(type: string, topics: string[], participantCount: number, duration: number): string {
  const summaryTemplates: Record<string, string[]> = {
    'Strategy Meeting': [
      `Strategic planning session focused on ${topics.join(', ')}. The ${participantCount}-person team spent ${duration} minutes aligning on key priorities and market positioning. Discussion centered around competitive analysis and feature development roadmap with emphasis on user experience improvements.`,
      `Product strategy discussion covering ${topics.slice(0, 2).join(' and ')}. Team evaluated market opportunities and resource allocation strategies over ${duration} minutes. Strong consensus emerged on prioritization framework and go-to-market approach.`,
      `Comprehensive strategy review involving ${participantCount} stakeholders. Key focus areas included ${topics.join(', ')} with detailed analysis of competitive landscape and customer feedback integration.`
    ],
    'Client Meeting': [
      `Client engagement session addressing ${topics.join(', ')}. Productive ${duration}-minute discussion with ${participantCount} participants covering project scope, timeline expectations, and deliverable specifications. Client provided valuable feedback on current progress and future requirements.`,
      `Stakeholder review meeting focused on ${topics.slice(0, 2).join(' and ')}. Clear communication established regarding project milestones and success criteria. Strong alignment achieved on next steps and communication protocols.`,
      `Client consultation covering ${topics.join(', ')}. Collaborative session lasting ${duration} minutes resulted in refined requirements and updated project timeline. Positive client engagement with current deliverables.`
    ],
    'Retrospective': [
      `Team retrospective examining ${topics.join(', ')}. ${participantCount} team members participated in ${duration}-minute reflection on recent sprint performance. Valuable insights shared on process improvements and team collaboration effectiveness.`,
      `Sprint retrospective focused on ${topics.slice(0, 3).join(', ')}. Open discussion revealed strengths in current workflow and opportunities for enhanced efficiency. Team demonstrated strong commitment to continuous improvement.`,
      `Reflective session covering ${topics.join(', ')}. Constructive dialogue among ${participantCount} participants identified key learnings and actionable improvements for future iterations.`
    ],
    'Technical Meeting': [
      `Technical architecture review addressing ${topics.join(', ')}. ${participantCount} engineers spent ${duration} minutes evaluating system design decisions and implementation strategies. Thorough analysis of scalability requirements and technology stack optimization.`,
      `Engineering discussion focused on ${topics.slice(0, 2).join(' and ')}. Deep dive into technical challenges and solution approaches with emphasis on performance optimization and maintainability.`,
      `Technical planning session covering ${topics.join(', ')}. Comprehensive evaluation of architecture patterns and integration requirements. Strong technical consensus on implementation approach.`
    ],
    'Marketing Meeting': [
      `Marketing strategy session focused on ${topics.join(', ')}. ${participantCount}-person team aligned on campaign objectives and target audience engagement strategies over ${duration} minutes. Clear roadmap established for upcoming marketing initiatives.`,
      `Campaign planning discussion addressing ${topics.slice(0, 2).join(' and ')}. Strategic evaluation of marketing channels and budget allocation with focus on ROI optimization and brand positioning.`,
      `Marketing review covering ${topics.join(', ')}. Collaborative planning session resulted in refined campaign strategy and clear timeline for execution. Strong team alignment on success metrics.`
    ]
  };

  const templates = summaryTemplates[type] || summaryTemplates['Strategy Meeting'];
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateKeyPoints(type: string, topics: string[]): string[] {
  const keyPointTemplates: Record<string, string[]> = {
    'Strategy Meeting': [
      'Market analysis shows strong growth opportunity in target segment',
      'Competitive positioning strategy refined based on latest research',
      'User feedback integration process streamlined for faster iteration',
      'Resource allocation optimized for Q1 priorities',
      'Feature prioritization framework established',
      'Go-to-market timeline confirmed for new product launch'
    ],
    'Client Meeting': [
      'Client requirements clarified and documented',
      'Project timeline adjusted based on stakeholder feedback',
      'Deliverable specifications updated to meet expectations',
      'Communication protocols established for ongoing collaboration',
      'Next milestone checkpoints scheduled',
      'Budget considerations aligned with project scope'
    ],
    'Retrospective': [
      'Team velocity improved by 25% over last sprint',
      'Code review process streamlined with new tools',
      'Cross-functional collaboration significantly enhanced',
      'Blocker resolution time reduced through better communication',
      'Documentation quality improved across all projects',
      'Knowledge sharing sessions proved highly effective'
    ],
    'Technical Meeting': [
      'Architecture scalability requirements clearly defined',
      'Technology stack decisions finalized for next phase',
      'Integration strategy approved for external services',
      'Performance optimization targets established',
      'Security requirements incorporated into design',
      'Development workflow enhanced with new tooling'
    ],
    'Marketing Meeting': [
      'Target audience segments refined based on data analysis',
      'Campaign budget allocation optimized across channels',
      'Brand messaging consistency improved across platforms',
      'ROI tracking mechanisms implemented for all campaigns',
      'Content calendar synchronized with product releases',
      'Social media strategy aligned with overall marketing goals'
    ]
  };

  const templates = keyPointTemplates[type] || keyPointTemplates['Strategy Meeting'];
  const count = Math.floor(Math.random() * 3) + 3; // 3-5 key points
  return templates.sort(() => 0.5 - Math.random()).slice(0, count);
}

function generateActionItems(type: string, topics: string[]): string[] {
  const actionTemplates: Record<string, string[]> = {
    'Strategy Meeting': [
      'Conduct competitive analysis deep-dive by end of week',
      'Update product roadmap based on strategy decisions',
      'Schedule follow-up stakeholder review in 2 weeks',
      'Prepare market research presentation for leadership team',
      'Create user feedback integration workflow documentation'
    ],
    'Client Meeting': [
      'Send updated project timeline to all stakeholders',
      'Schedule next client review meeting for milestone check',
      'Update requirements documentation based on feedback',
      'Prepare demo materials for upcoming presentation',
      'Set up regular communication cadence with client team'
    ],
    'Retrospective': [
      'Implement new code review checklist by next sprint',
      'Set up automated metrics dashboard for team velocity',
      'Schedule one-on-one meetings to address individual feedback',
      'Create knowledge sharing session calendar',
      'Update team process documentation'
    ],
    'Technical Meeting': [
      'Complete architecture documentation by Friday',
      'Set up performance monitoring for production systems',
      'Create technical spike tickets for proof of concepts',
      'Schedule security review with infosec team',
      'Update development environment setup guides'
    ],
    'Marketing Meeting': [
      'Launch A/B test for new campaign messaging',
      'Update marketing calendar with revised timeline',
      'Create content brief for upcoming product announcements',
      'Set up analytics tracking for new campaign metrics',
      'Schedule creative review session with design team'
    ]
  };

  const templates = actionTemplates[type] || actionTemplates['Strategy Meeting'];
  const count = Math.floor(Math.random() * 3) + 2; // 2-4 action items
  return templates.sort(() => 0.5 - Math.random()).slice(0, count);
}

function generateDecisions(type: string, topics: string[]): string[] {
  const decisionTemplates: Record<string, string[]> = {
    'Strategy Meeting': [
      'Approved shift in product positioning for enterprise market',
      'Confirmed budget increase for user research initiatives',
      'Decided to accelerate timeline for competitive feature parity',
      'Agreed on new pricing strategy for upcoming product tier'
    ],
    'Client Meeting': [
      'Approved scope adjustment to include mobile platform',
      'Confirmed revised delivery timeline for Phase 2',
      'Agreed on weekly check-in cadence going forward',
      'Decided to prioritize security features in current sprint'
    ],
    'Retrospective': [
      'Adopted new sprint planning process for better estimation',
      'Implemented pair programming for complex features',
      'Agreed to reduce meeting overhead by 30%',
      'Decided on new team communication tools'
    ],
    'Technical Meeting': [
      'Selected microservices architecture for next iteration',
      'Approved migration to new cloud infrastructure',
      'Confirmed technology stack for mobile application',
      'Decided on API versioning strategy for breaking changes'
    ],
    'Marketing Meeting': [
      'Approved budget reallocation toward digital channels',
      'Confirmed brand refresh timeline for Q2 launch',
      'Decided on influencer partnership strategy',
      'Agreed on content localization approach for new markets'
    ]
  };

  const templates = decisionTemplates[type] || decisionTemplates['Strategy Meeting'];
  const count = Math.floor(Math.random() * 3); // 0-2 decisions
  return templates.sort(() => 0.5 - Math.random()).slice(0, count);
} 