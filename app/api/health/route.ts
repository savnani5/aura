import { NextResponse } from 'next/server';
import { getConnectionHealth, connectToDatabase, getCacheStats } from '@/lib/mongodb';

// GET /api/health - Health check for database and services
export async function GET() {
  try {
    // Get detailed connection health
    const healthBefore = await getConnectionHealth();
    
    // If not connected, try to connect
    if (!healthBefore.isConnected) {
      await connectToDatabase();
    }
    
    // Get health after potential connection
    const healthAfter = await getConnectionHealth();
    const cacheStats = getCacheStats();
    
    return NextResponse.json({
      success: true,
      connection: {
        isConnected: healthAfter.isConnected,
        readyState: healthAfter.readyState,
        ping: healthAfter.ping,
        connectionAge: healthAfter.connectionAge,
        lastHealthCheck: new Date(healthAfter.lastHealthCheck).toISOString()
      },
      cache: {
        size: healthAfter.cacheSize,
        isActive: healthAfter.cacheSize > 0,
        memoryUsage: cacheStats.memoryUsage,
        hitRate: `${cacheStats.hitRate}%`,
        oldestEntry: cacheStats.oldestEntry
      },
      performance: {
        connectionTime: healthBefore.isConnected ? 0 : (healthAfter.ping || 0),
        cacheHitRate: healthAfter.cacheSize > 0 ? `${cacheStats.hitRate}% hit rate` : 'Warming up',
        avgResponseTime: healthAfter.ping ? `${healthAfter.ping}ms` : 'N/A'
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      optimizations: {
        connectionWarming: true,
        intelligentCaching: true,
        requestDeduplication: true,
        aggressiveTimeouts: true
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 