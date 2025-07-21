import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/database/mongodb';

export async function GET(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For now, simple admin check - you can enhance this later
    // You could check if the user is an admin in your database
    
    const { searchParams } = new URL(req.url);
    const referralCode = searchParams.get('ref');
    const action = searchParams.get('action') || 'stats';

    const db = DatabaseService.getInstance();

    if (action === 'users' && referralCode) {
      // Get specific users for a referral code
      const users = await db.getUsersByReferralCode(referralCode);
      
      return NextResponse.json({
        success: true,
        referralCode,
        users,
        totalUsers: users.length,
        subscribedUsers: users.filter(u => u.hasActiveSubscription).length
      });
    } else {
      // Get affiliate statistics
      const stats = await db.getAffiliateStats(referralCode || undefined);
      
      return NextResponse.json({
        success: true,
        stats,
        totalAffiliates: stats.length,
        totalReferrals: stats.reduce((sum, stat) => sum + stat.totalReferrals, 0),
        totalSubscriptions: stats.reduce((sum, stat) => sum + stat.subscribedReferrals, 0)
      });
    }

  } catch (error) {
    console.error('❌ Error fetching affiliate data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 