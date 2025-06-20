/**
 * Test transcript storage and summary generation
 */

const testTranscriptFlow = async () => {
  console.log('📝 Testing Transcript Storage and Summary Generation...\n');

  try {
    const testMeetingId = '507f1f77bcf86cd799439011';
    
    // Realistic meeting transcripts
    const testTranscripts = [
      {
        speaker: 'John Doe',
        text: 'Good morning everyone! Welcome to our daily standup. Let\'s go around and share our updates. Jane, would you like to start?',
        timestamp: Date.now() - 300000 // 5 minutes ago
      },
      {
        speaker: 'Jane Smith',
        text: 'Sure! Yesterday I completed the user authentication feature. I implemented OAuth integration with Google and GitHub. The PR is ready for review.',
        timestamp: Date.now() - 270000 // 4.5 minutes ago
      },
      {
        speaker: 'Bob Wilson',
        text: 'Great work Jane! I reviewed the database optimization changes and they look good. I merged them yesterday and we\'re seeing 30% performance improvement.',
        timestamp: Date.now() - 240000 // 4 minutes ago
      },
      {
        speaker: 'Jane Smith',
        text: 'That\'s awesome Bob! Today I plan to start working on the API integration tests. I should have the basic framework setup by end of day.',
        timestamp: Date.now() - 210000 // 3.5 minutes ago
      },
      {
        speaker: 'John Doe',
        text: 'Excellent progress everyone. Bob, what are you working on today?',
        timestamp: Date.now() - 180000 // 3 minutes ago
      },
      {
        speaker: 'Bob Wilson',
        text: 'I\'m going to work on the real-time notifications feature. I need to set up WebSocket connections for live updates.',
        timestamp: Date.now() - 150000 // 2.5 minutes ago
      },
      {
        speaker: 'John Doe',
        text: 'Sounds good. Any blockers or concerns? Jane, do you need any help with the API testing framework?',
        timestamp: Date.now() - 120000 // 2 minutes ago
      },
      {
        speaker: 'Jane Smith',
        text: 'I think I\'m good for now, but I might need Bob\'s input on the database testing scenarios later this week.',
        timestamp: Date.now() - 90000 // 1.5 minutes ago
      },
      {
        speaker: 'Bob Wilson',
        text: 'Absolutely! Just ping me when you\'re ready. I should have the notifications feature done by Thursday.',
        timestamp: Date.now() - 60000 // 1 minute ago
      },
      {
        speaker: 'John Doe',
        text: 'Perfect! Great work everyone. Let\'s sync up again tomorrow. Have a productive day!',
        timestamp: Date.now() - 30000 // 30 seconds ago
      }
    ];

    const testParticipants = [
      { 
        name: 'John Doe', 
        isHost: true, 
        joinedAt: new Date(Date.now() - 360000).toISOString(), // 6 minutes ago
        leftAt: new Date().toISOString()
      },
      { 
        name: 'Jane Smith', 
        isHost: false, 
        joinedAt: new Date(Date.now() - 350000).toISOString(), 
        leftAt: new Date().toISOString()
      },
      { 
        name: 'Bob Wilson', 
        isHost: false, 
        joinedAt: new Date(Date.now() - 340000).toISOString(), 
        leftAt: new Date().toISOString()
      }
    ];

    console.log('📊 Test Data Summary:');
    console.log(`   - Meeting ID: ${testMeetingId}`);
    console.log(`   - Transcripts: ${testTranscripts.length} entries`);
    console.log(`   - Participants: ${testParticipants.length} people`);
    console.log(`   - Duration: ~6 minutes`);
    console.log(`   - Meeting Type: STANDUP (good for summary generation)`);

    // Step 1: Test meeting end with real transcripts
    console.log('\n🔚 Step 1: Ending meeting with real transcripts...');
    
    const endMeetingResponse = await fetch('http://localhost:3000/api/meetings/test-room/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId: testMeetingId,
        transcripts: testTranscripts,
        participants: testParticipants,
        endedAt: new Date().toISOString(),
        duration: 6
      }),
    });

    console.log('📊 Meeting End Response Status:', endMeetingResponse.status);
    
    if (!endMeetingResponse.ok) {
      const errorText = await endMeetingResponse.text();
      throw new Error(`Meeting end API failed: ${endMeetingResponse.status} - ${errorText}`);
    }

    const endMeetingData = await endMeetingResponse.json();
    console.log('📊 Meeting End Response:');
    console.log(JSON.stringify(endMeetingData, null, 2));

    if (!endMeetingData.success) {
      throw new Error(`Meeting end failed: ${endMeetingData.error}`);
    }

    console.log('\n✅ Meeting End Success!');
    console.log(`   - Transcripts Stored: ${endMeetingData.data.transcriptsStored}`);
    console.log(`   - Summary Generated: ${endMeetingData.data.summaryGenerated}`);
    console.log(`   - Duration: ${endMeetingData.data.duration} minutes`);

    // Step 2: Wait for processing and verify storage
    console.log('\n⏳ Waiting for transcript processing and summary generation...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    // Step 3: Verify transcript storage
    console.log('\n🔍 Step 2: Verifying transcript storage...');
    
    const detailsResponse = await fetch(`http://localhost:3000/api/meeting-details/${testMeetingId}`);
    console.log('📋 Meeting Details Response Status:', detailsResponse.status);
    
    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      throw new Error(`Meeting details API failed: ${detailsResponse.status} - ${errorText}`);
    }

    const detailsData = await detailsResponse.json();
    
    if (!detailsData.success || !detailsData.data) {
      throw new Error(`Failed to get meeting details: ${detailsData.error}`);
    }

    const meeting = detailsData.data;
    console.log('\n📊 Meeting Verification Results:');
    console.log(`   - Meeting ID: ${meeting._id}`);
    console.log(`   - Title: ${meeting.title}`);
    console.log(`   - Type: ${meeting.type}`);
    console.log(`   - Ended At: ${meeting.endedAt || 'Not set'}`);
    console.log(`   - Duration: ${meeting.duration || 'Not set'} minutes`);
    console.log(`   - Transcripts Count: ${meeting.transcripts?.length || 0}`);
    console.log(`   - Expected Transcripts: ${testTranscripts.length}`);
    console.log(`   - Summary Available: ${meeting.summary ? '✅' : '❌'}`);

    // Detailed transcript verification
    if (meeting.transcripts && meeting.transcripts.length > 0) {
      console.log('\n📝 Stored Transcripts:');
      meeting.transcripts.forEach((t, i) => {
        const timestamp = new Date(t.timestamp).toLocaleTimeString();
        console.log(`   ${i + 1}. [${timestamp}] ${t.speaker}: ${t.text.substring(0, 80)}...`);
      });

      // Check if embeddings were generated
      const transcriptsWithEmbeddings = meeting.transcripts.filter(t => t.embedding && t.embedding.length > 0);
      console.log(`\n🔗 Embeddings Generated: ${transcriptsWithEmbeddings.length}/${meeting.transcripts.length} transcripts`);
    } else {
      console.log('\n❌ No transcripts found in stored meeting');
    }

    // Detailed summary verification
    if (meeting.summary) {
      console.log('\n📄 Generated Summary Details:');
      console.log(`   Generated At: ${meeting.summary.generatedAt}`);
      console.log(`   Content Length: ${meeting.summary.content?.length || 0} characters`);
      console.log(`   Key Points: ${meeting.summary.keyPoints?.length || 0} items`);
      console.log(`   Action Items: ${meeting.summary.actionItems?.length || 0} items`);
      console.log(`   Decisions: ${meeting.summary.decisions?.length || 0} items`);
      
      console.log('\n📄 Summary Content Preview:');
      console.log(`   "${meeting.summary.content.substring(0, 200)}..."`);
      
      if (meeting.summary.keyPoints && meeting.summary.keyPoints.length > 0) {
        console.log('\n🔑 Key Points:');
        meeting.summary.keyPoints.forEach((point, i) => {
          console.log(`   ${i + 1}. ${point}`);
        });
      }
      
      if (meeting.summary.actionItems && meeting.summary.actionItems.length > 0) {
        console.log('\n✅ Action Items:');
        meeting.summary.actionItems.forEach((item, i) => {
          console.log(`   ${i + 1}. ${item}`);
        });
      }
    } else {
      console.log('\n❌ No summary generated');
    }

    // Final assessment
    console.log('\n🎯 Final Assessment:');
    
    const transcriptMatch = meeting.transcripts?.length === testTranscripts.length;
    const hasValidSummary = meeting.summary && meeting.summary.content && meeting.summary.content.length > 0;
    const hasEmbeddings = meeting.transcripts?.some(t => t.embedding && t.embedding.length > 0);
    
    console.log(`   ✅ Transcripts Stored: ${transcriptMatch ? 'PASS' : 'FAIL'} (${meeting.transcripts?.length || 0}/${testTranscripts.length})`);
    console.log(`   ✅ Summary Generated: ${hasValidSummary ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Embeddings Created: ${hasEmbeddings ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Meeting Properly Ended: ${meeting.endedAt ? 'PASS' : 'FAIL'}`);
    
    const allTestsPassed = transcriptMatch && hasValidSummary && hasEmbeddings && meeting.endedAt;
    
    if (allTestsPassed) {
      console.log('\n🎉 SUCCESS: All transcript storage and summary generation tests PASSED!');
      console.log('   The meeting end flow is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the details above.');
    }

  } catch (error) {
    console.error('\n💥 Test Failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

testTranscriptFlow().then(() => {
  console.log('\n🏁 Transcript flow test completed.');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Transcript flow test failed:', error);
  process.exit(1);
}); 