import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

export async function DELETE() {
  try {
    const db = DatabaseService.getInstance();
    await db.ensureConnection();
    
    console.log('🧹 Cleaning up duplicate users...');
    
    // Get all users and find duplicates by clerkId
    const { User } = await import('@/lib/mongodb');
    const allUsers = await User.find({}).lean();
    
    console.log(`Found ${allUsers.length} total users`);
    
    // Group by clerkId to find duplicates
    const usersByClerkId = new Map();
    const duplicates = [];
    
    for (const user of allUsers) {
      if (usersByClerkId.has(user.clerkId)) {
        duplicates.push(user);
      } else {
        usersByClerkId.set(user.clerkId, user);
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate users`);
    
    // Delete duplicates (keep the first one found)
    let deletedCount = 0;
    for (const duplicate of duplicates) {
      await User.findByIdAndDelete(duplicate._id);
      deletedCount++;
      console.log(`Deleted duplicate user: ${duplicate.clerkId} (${duplicate.name})`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} duplicate users`,
      data: {
        totalUsers: allUsers.length,
        duplicatesRemoved: deletedCount,
        uniqueUsers: usersByClerkId.size
      }
    });
    
  } catch (error) {
    console.error('Error cleaning users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clean users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 