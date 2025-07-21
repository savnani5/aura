import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbService = DatabaseService.getInstance();
    const subscription = await dbService.getUserSubscription(userId);

    if (!subscription) {
      return NextResponse.json({
        hasActiveSubscription: false,
        subscriptionStatus: null,
      });
    }

    return NextResponse.json(subscription);

  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 