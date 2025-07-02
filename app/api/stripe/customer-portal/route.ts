import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

export async function POST(req: NextRequest) {
  console.log('🔗 Creating customer portal session...');
  
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ No authenticated user found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database and find user
    await connectToDatabase();
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      console.log('❌ User not found in database:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.stripeCustomerId) {
      console.log('❌ No Stripe customer ID found for user:', userId);
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    console.log('💳 Creating portal session for customer:', user.stripeCustomerId);

    // Create the customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/manage`,
    });

    console.log('✅ Portal session created:', portalSession.id);

    return NextResponse.json({
      url: portalSession.url
    });

  } catch (error) {
    console.error('❌ Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
} 