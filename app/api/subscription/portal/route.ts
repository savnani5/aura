import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/mongodb';
import { StripeService } from '@/lib/stripe-service';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbService = DatabaseService.getInstance();
    const stripeService = StripeService.getInstance();

    // Get user from database
    const user = await dbService.getUserByClerkId(userId);
    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Create customer portal session
    const portalSession = await stripeService.createPortalSession(
      user.stripeCustomerId,
      `${process.env.NEXT_PUBLIC_APP_URL}/subscription`
    );

    return NextResponse.json({ 
      url: portalSession.url 
    });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 