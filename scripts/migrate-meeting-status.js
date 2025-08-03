const mongoose = require('mongoose');
require('dotenv').config();

// Meeting schema
const meetingSchema = new mongoose.Schema({}, { strict: false });
const Meeting = mongoose.model('Meeting', meetingSchema);

async function migrateMeetingStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all meetings without a status field
    const meetingsWithoutStatus = await Meeting.find({
      status: { $exists: false }
    });

    console.log(`Found ${meetingsWithoutStatus.length} meetings without status field`);

    let updated = 0;
    for (const meeting of meetingsWithoutStatus) {
      let status;
      
      // Determine status based on existing fields
      if (meeting.endedAt) {
        // Meeting has ended
        if (meeting.processingStatus === 'completed') {
          status = 'completed';
        } else if (meeting.processingStatus === 'in_progress' || meeting.processingStatus === 'pending') {
          status = 'processing';
        } else {
          status = 'completed'; // Default for ended meetings
        }
      } else if (meeting.startedAt && !meeting.endedAt) {
        // Meeting started but not ended - check if it's stale
        const meetingAge = Date.now() - new Date(meeting.startedAt).getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (meetingAge > oneDay) {
          // Meeting is over a day old without being ended - mark as completed
          status = 'completed';
          meeting.endedAt = meeting.startedAt; // Set endedAt to startedAt for cleanup
        } else {
          status = 'active';
        }
      } else {
        // Shouldn't happen, but default to completed
        status = 'completed';
      }

      // Also ensure activeParticipantCount exists
      if (meeting.activeParticipantCount === undefined) {
        meeting.activeParticipantCount = 0;
      }

      // Ensure lastActivity exists
      if (!meeting.lastActivity) {
        meeting.lastActivity = meeting.updatedAt || meeting.createdAt || new Date();
      }

      // Update the meeting
      await Meeting.updateOne(
        { _id: meeting._id },
        { 
          $set: { 
            status,
            activeParticipantCount: meeting.activeParticipantCount,
            lastActivity: meeting.lastActivity
          }
        }
      );
      
      updated++;
      console.log(`Updated meeting ${meeting._id} with status: ${status}`);
    }

    console.log(`\nMigration complete! Updated ${updated} meetings.`);

    // Show status distribution
    const statusCounts = await Meeting.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\nMeeting status distribution:');
    statusCounts.forEach(item => {
      console.log(`  ${item._id}: ${item.count} meetings`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateMeetingStatus();