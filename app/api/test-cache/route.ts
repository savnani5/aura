import { NextResponse } from 'next/server';
import { withCachedDatabaseOperation, getCacheKey, getConnectionHealth } from '@/lib/mongodb';
import { MeetingRoom } from '@/lib/mongodb';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Test cache with a simple query
    const cacheKey = getCacheKey('test-rooms-count', {});
    const roomCount = await withCachedDatabaseOperation(
      async () => {
        // Simulate a slow query
        await new Promise(resolve => setTimeout(resolve, 100));
        return await MeetingRoom.countDocuments();
      },
      cacheKey,
      60000, // 1 minute cache
      'test-rooms-count'
    );
    
    const queryTime = Date.now() - startTime;
    const health = await getConnectionHealth();
    
    return NextResponse.json({
      success: true,
      data: {
        roomCount,
        queryTime: `${queryTime}ms`,
        cacheSize: health.cacheSize,
        ping: health.ping,
        isFromCache: queryTime < 50 // If query was fast, likely from cache
      },
      message: queryTime < 50 ? 'Cache hit! ⚡' : 'Cache miss - data cached for next time 💾',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 