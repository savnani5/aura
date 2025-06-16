import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb-lite';
import mongoose from 'mongoose';

// GET /api/health - Health check for database and services
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Test lightweight connection
    await connectDB();
    
    // Verify connection state
    const isConnected = mongoose.connection.readyState === 1;
    const connectionTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      connected: isConnected,
      connectionTime: `${connectionTime}ms`,
      implementation: 'FastDB Lite',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    });
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      connected: false,
      connectionTime: `${connectionTime}ms`,
      implementation: 'FastDB Lite',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 500 });
  }
} 