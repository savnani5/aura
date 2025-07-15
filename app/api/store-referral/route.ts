import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { referralCode } = await req.json();

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    // Update user with referral information
    const db = DatabaseService.getInstance();
    const updatedUser = await db.updateUser(userId, {
      referredBy: referralCode
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Stored referral code "${referralCode}" for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Referral stored successfully'
    });

  } catch (error) {
    console.error('❌ Error storing referral:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 