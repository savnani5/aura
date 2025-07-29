import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

// GET /api/subscription/usage - Get user's current usage and limits
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const db = DatabaseService.getInstance();
    
    // Get user's subscription status (you might want to integrate with your existing subscription context)
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // For now, assume free users have 10 meeting limit, pro users have unlimited
    // You can integrate this with your existing subscription logic
    const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
    const meetingLimit = hasActiveSubscription ? -1 : 10; // -1 means unlimited
    
    if (hasActiveSubscription) {
      // Pro users have unlimited meetings
      return NextResponse.json({
        success: true,
        data: {
          plan: 'pro',
          unlimited: true,
          currentCount: 0,
          limit: -1,
          remaining: -1,
          exceeded: false
        }
      });
    }

    // Free users - check their usage
    const usageData = await db.hasExceededMeetingLimit(userId, meetingLimit);
    
    return NextResponse.json({
      success: true,
      data: {
        plan: 'free',
        unlimited: false,
        ...usageData
      }
    });

  } catch (error) {
    console.error('Error checking usage:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check usage'
    }, { status: 500 });
  }
} 