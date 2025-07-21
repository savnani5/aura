require('dotenv').config({ path: '.env.local' });
const { DatabaseService } = require('./lib/database/mongodb');

async function checkRoom() {
  const dbService = DatabaseService.getInstance();
  const room = await dbService.getMeetingRoomByName('ohm-team-sync-mbzf9lvd');
  console.log('Room from MongoDB:');
  console.log('  _id:', room._id);
  console.log('  _id type:', typeof room._id);
  console.log('  _id string:', room._id.toString());
  console.log('  roomName:', room.roomName);
  console.log('  title:', room.title);
}

checkRoom().catch(console.error); 