import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook routes are working correctly',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    console.log('🧪 Test webhook received:', body.substring(0, 100));
    
    return NextResponse.json({
      status: 'ok',
      message: 'Test webhook received successfully',
      bodyLength: body.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in test webhook:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Test webhook failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 