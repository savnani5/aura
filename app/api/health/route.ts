import { NextResponse } from 'next/server';
import { isDatabaseConnected, connectToDatabase } from '@/lib/database/mongodb';

// GET /api/health - Health check for database and services
export async function GET() {
  try {
    // Check if already connected
    const isConnected = await isDatabaseConnected();
    
    if (!isConnected) {
      // Try to connect
      await connectToDatabase();
    }
    
    // Verify connection again
    const finalConnectionState = await isDatabaseConnected();
    
    return NextResponse.json({
      success: true,
      connected: finalConnectionState,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 500 });
  }
} 