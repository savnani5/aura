#!/usr/bin/env node

/**
 * Comprehensive Meeting Migration Script
 * 
 * This script:
 * 1. Migrates all meetings with transcripts to the new structured context format
 * 2. Deletes meetings that have no transcripts and no summaries (cleanup)
 * 3. Provides detailed reporting on what was processed
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ohm-transcripts';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 5; // Process meetings in batches to avoid rate limits

if (!MONGODB_URI || !ANTHROPIC_API_KEY || !PINECONE_API_KEY) {
  console.error('❌ Missing required environment variables: MONGODB_URI, ANTHROPIC_API_KEY, PINECONE_API_KEY');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * Fetch transcripts from Pinecone for a specific meeting
 */
async function fetchTranscriptsFromPinecone(meetingId) {
  try {
    const { Pinecone } = await import('@pinecone-database/pinecone');
    
    const pc = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });

    const index = pc.index(PINECONE_INDEX_NAME);
    
    // Query Pinecone for all transcripts with this meetingId
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
      topK: 1000, // Get all transcripts for this meeting
      includeMetadata: true,
      filter: {
        meetingId: { $eq: meetingId }
      }
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return [];
    }

    // Sort by transcriptIndex to maintain order
    const sortedTranscripts = queryResponse.matches
      .map(match => ({
        speaker: match.metadata.speaker,
        text: match.metadata.text,
        timestamp: match.metadata.timestamp,
        transcriptIndex: match.metadata.transcriptIndex || 0
      }))
      .sort((a, b) => a.transcriptIndex - b.transcriptIndex);

    return sortedTranscripts;

  } catch (error) {
    console.error(`   ❌ Error fetching transcripts from Pinecone:`, error);
    return [];
  }
}

/**
 * Generate new summary with structured context using actual transcripts
 */
async function generateDetailedSummary(transcripts, meetingType, participants) {
  const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
  const limitedTranscript = transcriptText.length > 8000 
    ? transcriptText.substring(0, 8000) + '...'
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
- Include structured context for important points - these will be shown in rich popups
- Focus on capturing substance and details discussed, like comprehensive meeting notes
- For brief meetings, don't force artificial structure - adapt to the content
- Prioritize quality over quantity - better to have fewer, more meaningful sections`;

  const userPrompt = `Meeting Type: ${meetingType}
Participants: ${participantNames}
Transcript: ${limitedTranscript}

Return only valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
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
  } catch (error) {
    console.error('❌ Error generating summary with Claude:', error);
    throw error;
  }
}

/**
 * Delete meetings that have no transcripts and no summaries
 */
async function cleanupEmptyMeetings(meetingsCollection) {
  console.log('\n🧹 Starting cleanup of meetings without transcripts or summaries...');
  
  // Find meetings with no transcripts and no summaries
  const emptyMeetings = await meetingsCollection.find({
    $and: [
      {
        $or: [
          { hasEmbeddings: { $ne: true } },
          { hasEmbeddings: { $exists: false } }
        ]
      },
      {
        $or: [
          { transcriptCount: { $lte: 0 } },
          { transcriptCount: { $exists: false } }
        ]
      },
      {
        $or: [
          { 'summary.content': { $exists: false } },
          { 'summary.content': '' },
          { 'summary.content': null }
        ]
      }
    ]
  }).toArray();

  console.log(`📊 Found ${emptyMeetings.length} meetings to clean up (no transcripts and no summaries)`);

  if (emptyMeetings.length === 0) {
    console.log('✅ No empty meetings to clean up');
    return { deleted: 0, errors: 0 };
  }

  let deleted = 0;
  let errors = 0;

  for (const meeting of emptyMeetings) {
    try {
      console.log(`   🗑️  Deleting empty meeting: ${meeting._id} - "${meeting.title || meeting.type}"`);
      
      if (!DRY_RUN) {
        await meetingsCollection.deleteOne({ _id: meeting._id });
        deleted++;
      } else {
        console.log(`   🔍 DRY RUN: Would delete meeting ${meeting._id}`);
        deleted++;
      }
    } catch (error) {
      console.error(`   ❌ Error deleting meeting ${meeting._id}:`, error);
      errors++;
    }
  }

  return { deleted, errors };
}

/**
 * Main migration function
 */
async function migrateAllMeetings() {
  console.log('🚀 Starting comprehensive meeting migration...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`📦 Batch size: ${BATCH_SIZE} meetings at a time`);
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const meetingsCollection = db.collection('meetings');
    
    // Step 1: Clean up empty meetings first
    const cleanupResults = await cleanupEmptyMeetings(meetingsCollection);
    
    // Step 2: Find meetings with transcripts to migrate
    const meetingsToMigrate = await meetingsCollection.find({
      hasEmbeddings: true,
      transcriptCount: { $gt: 0 }
    }).toArray();
    
    console.log(`\n📊 Found ${meetingsToMigrate.length} meetings with transcripts to migrate`);
    
    if (meetingsToMigrate.length === 0) {
      console.log('✅ No meetings found with transcripts to migrate.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < meetingsToMigrate.length; i += BATCH_SIZE) {
      const batch = meetingsToMigrate.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(meetingsToMigrate.length / BATCH_SIZE)} (${batch.length} meetings)`);
      
      for (let j = 0; j < batch.length; j++) {
        const meeting = batch[j];
        const overallIndex = i + j + 1;
        
        console.log(`\n📝 Processing meeting ${overallIndex}/${meetingsToMigrate.length}: ${meeting._id}`);
        console.log(`   Title: ${meeting.title || meeting.type}`);
        console.log(`   Date: ${meeting.startedAt ? new Date(meeting.startedAt).toLocaleDateString() : 'Unknown'}`);
        console.log(`   Transcript Count: ${meeting.transcriptCount || 0}`);
        
        try {
          // Check if already migrated (has sections)
          if (meeting.summary?.sections && meeting.summary.sections.length > 0) {
            console.log('   ⏭️  Already migrated - skipping');
            skippedCount++;
            continue;
          }
          
          // Fetch transcripts from Pinecone
          console.log('   🔍 Fetching transcripts from Pinecone...');
          const transcripts = await fetchTranscriptsFromPinecone(meeting._id.toString());
          
          if (transcripts.length === 0) {
            console.log('   ⚠️  No transcripts found in Pinecone - skipping');
            skippedCount++;
            continue;
          }
          
          console.log(`   📝 Found ${transcripts.length} transcript chunks`);
          
          // Extract participant names
          const participantNames = meeting.participants?.map(p => p.name).filter(Boolean) || [];
          
          // Generate new detailed summary
          console.log('   🤖 Generating detailed summary with structured context...');
          const newSummary = await generateDetailedSummary(
            transcripts,
            meeting.type || 'Meeting',
            participantNames
          );
          
          console.log(`   ✅ Generated ${newSummary.sections?.length || 0} sections`);
          console.log(`   📋 Action items: ${newSummary.actionItems?.length || 0}`);
          
          if (!DRY_RUN) {
            // Update the meeting in database
            await meetingsCollection.updateOne(
              { _id: meeting._id },
              { 
                $set: { 
                  'summary': newSummary,
                  'migratedAt': new Date()
                }
              }
            );
            console.log('   💾 Updated in database');
          } else {
            console.log('   🔍 DRY RUN: Would update in database');
            if (newSummary.sections) {
              console.log('   📋 New sections:');
              newSummary.sections.forEach((section, idx) => {
                console.log(`      ${idx + 1}. ${section.title} (${section.points.length} points)`);
                section.points.forEach((point, pointIdx) => {
                  const hasContext = point.context ? '🔗' : '  ';
                  console.log(`         ${hasContext} ${point.text.substring(0, 60)}...`);
                });
              });
            }
          }
          
          successCount++;
          
        } catch (error) {
          console.error(`   ❌ Error processing meeting ${meeting._id}:`, error);
          errorCount++;
        }
      }
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < meetingsToMigrate.length) {
        console.log('   ⏳ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   🧹 Cleanup: ${cleanupResults.deleted} empty meetings deleted`);
    if (cleanupResults.errors > 0) {
      console.log(`   ❌ Cleanup errors: ${cleanupResults.errors}`);
    }
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Already migrated (skipped): ${skippedCount}`);
    console.log(`   ❌ Migration errors: ${errorCount}`);
    console.log(`   📝 Total meetings processed: ${meetingsToMigrate.length}`);
    
    if (DRY_RUN) {
      console.log('\n🔍 This was a DRY RUN. No changes were made to the database.');
      console.log('   Run without --dry-run flag to apply changes.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrateAllMeetings()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAllMeetings }; 