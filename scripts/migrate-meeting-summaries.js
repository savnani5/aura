#!/usr/bin/env node

/**
 * Migration Script: Convert existing meeting summaries to new sections format
 * 
 * This script:
 * 1. Fetches all meetings with summaries from MongoDB
 * 2. For each meeting with old format (keyPoints), converts to new sections format
 * 3. Uses Claude AI to intelligently restructure the content
 * 4. Updates the database with the new format
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!MONGODB_URI || !ANTHROPIC_API_KEY) {
  console.error('❌ Missing required environment variables: MONGODB_URI, ANTHROPIC_API_KEY');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * Convert old summary format to new sections format using Claude
 */
async function convertSummaryToSections(oldSummary, meetingType, participants) {
  const systemPrompt = `You are converting an old meeting summary format to a new detailed sections format.

TASK: Convert the provided old summary into the new structured format with detailed sections.

OLD FORMAT INPUT:
- content: brief summary text
- keyPoints: array of bullet points
- actionItems: array of action items
- decisions: array of decisions

NEW FORMAT OUTPUT (JSON):
{
  "title": "concise 4-8 word meeting title",
  "content": "2-3 sentence overall summary (keep or improve the original)",
  "sections": [
    {
      "title": "section name based on content themes",
      "points": [
        {
          "text": "detailed bullet point expanding on the original key points",
          "speaker": null,
          "transcriptReference": null
        }
      ]
    }
  ]
}

GUIDELINES:
- Create 2-4 sections based on the key points and content
- If there are action items, create an "Action Items & Next Steps" section
- If there are decisions, integrate them into relevant sections
- Expand on the original key points to make them more detailed and informative
- Since this is migrating old data, speaker and transcriptReference will be null
- Maintain the essence and accuracy of the original content
- Create logical groupings of related points into sections`;

  const userPrompt = `Meeting Type: ${meetingType}
Participants: ${participants.join(', ')}

OLD SUMMARY:
Content: ${oldSummary.content || 'No content available'}

Key Points:
${oldSummary.keyPoints?.map(point => `- ${point}`).join('\n') || 'No key points'}

Action Items:
${oldSummary.actionItems?.map(item => {
  if (typeof item === 'string') return `- ${item}`;
  return `- ${item.title} (${item.owner}, ${item.priority})`;
}).join('\n') || 'No action items'}

Decisions:
${oldSummary.decisions?.map(decision => `- ${decision}`).join('\n') || 'No decisions'}

Convert this to the new sections format. Return only valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
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
    
    // Merge with original summary structure
    return {
      title: parsed.title || oldSummary.title,
      content: parsed.content || oldSummary.content,
      sections: parsed.sections || [],
      keyPoints: oldSummary.keyPoints, // Keep for backward compatibility
      actionItems: oldSummary.actionItems,
      decisions: oldSummary.decisions,
      generatedAt: oldSummary.generatedAt
    };
  } catch (error) {
    console.error('❌ Error converting summary with Claude:', error);
    // Return original summary if conversion fails
    return oldSummary;
  }
}

/**
 * Main migration function
 */
async function migrateMeetingSummaries() {
  console.log('🚀 Starting meeting summaries migration...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const meetingsCollection = db.collection('meetings');
    
    // Find all meetings with summaries that need migration
    const meetingsToMigrate = await meetingsCollection.find({
      'summary.keyPoints': { $exists: true, $ne: null, $not: { $size: 0 } },
      'summary.sections': { $exists: false }
    }).toArray();
    
    console.log(`📊 Found ${meetingsToMigrate.length} meetings to migrate`);
    
    if (meetingsToMigrate.length === 0) {
      console.log('✅ No meetings need migration. All meetings are already in the new format or have no summaries.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < meetingsToMigrate.length; i++) {
      const meeting = meetingsToMigrate[i];
      
      console.log(`\n📝 Processing meeting ${i + 1}/${meetingsToMigrate.length}: ${meeting._id}`);
      console.log(`   Title: ${meeting.title || meeting.type}`);
      console.log(`   Date: ${meeting.startedAt ? new Date(meeting.startedAt).toLocaleDateString() : 'Unknown'}`);
      
      try {
        // Extract participant names
        const participantNames = meeting.participants?.map(p => p.name).filter(Boolean) || [];
        
        // Convert summary using Claude
        console.log('   🤖 Converting summary with Claude AI...');
        const newSummary = await convertSummaryToSections(
          meeting.summary,
          meeting.type || 'Meeting',
          participantNames
        );
        
        console.log(`   ✅ Generated ${newSummary.sections?.length || 0} sections`);
        
        if (!DRY_RUN) {
          // Update the meeting in database
          await meetingsCollection.updateOne(
            { _id: meeting._id },
            { 
              $set: { 
                'summary': newSummary,
                'migrationUpdatedAt': new Date()
              }
            }
          );
          console.log('   💾 Updated in database');
        } else {
          console.log('   🔍 DRY RUN: Would update in database');
          console.log('   📋 New sections:');
          newSummary.sections?.forEach((section, idx) => {
            console.log(`      ${idx + 1}. ${section.title} (${section.points.length} points)`);
          });
        }
        
        successCount++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error processing meeting ${meeting._id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total meetings: ${meetingsToMigrate.length}`);
    
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
  migrateMeetingSummaries()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateMeetingSummaries }; 