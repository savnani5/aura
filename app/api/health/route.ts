import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/mongodb';

// GET /api/health - Health check for database and services
export async function GET() {
  try {
    const db = DatabaseService.getInstance();
    await db.ensureConnection();
    
    return NextResponse.json({
      success: true,
      message: 'Ohm API is healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        api: 'running'
      }
    }, { status: 503 });
  }
} 