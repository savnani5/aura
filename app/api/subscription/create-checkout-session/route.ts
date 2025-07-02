import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseService } from '@/lib/mongodb';
import { StripeService } from '@/lib/stripe-service';
import Stripe from 'stripe';

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
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🔍 Creating checkout session for user:', user.name, user.email);

    // Check if user already has a Stripe customer ID
    let customerId = user.stripeCustomerId;
    
    if (customerId) {
      console.log('🔍 Verifying existing customer ID:', customerId);
      
      // Verify the customer still exists in Stripe
      const customerExists = await stripeService.verifyCustomerExists(customerId);
      
      if (!customerExists) {
        console.log('❌ Customer no longer exists in Stripe:', customerId);
        console.log('🔄 Will create new customer and reset subscription data');
        
        // Customer doesn't exist, reset all subscription data and create new customer
        customerId = undefined;
        
        // Clear all subscription-related fields in the database
        await dbService.updateUserSubscription(userId, {
          stripeCustomerId: undefined,
          stripeSubscriptionId: undefined,
          subscriptionStatus: undefined,
          subscriptionCurrentPeriodEnd: undefined,
          subscriptionCreatedAt: undefined,
          trialEndsAt: undefined
        });
        
        console.log('✅ Reset user subscription data due to invalid customer');
      } else {
        console.log('✅ Existing customer verified:', customerId);
      }
    }
    
    if (!customerId) {
      console.log('👤 Creating new Stripe customer for user:', user.name);
      
      // Create new Stripe customer
      const customer = await stripeService.createCustomer(
        user.email || '',
        user.name
      );
      customerId = customer.id;
      
      console.log('✅ Created Stripe customer:', customerId);
      
      // Update user with customer ID - using better error handling
      try {
        const updatedUser = await dbService.updateUserSubscription(userId, {
          stripeCustomerId: customerId,
        });
        
        if (updatedUser) {
          console.log('✅ Successfully linked customer ID to user in database');
        } else {
          console.error('❌ Failed to update user with customer ID');
          return NextResponse.json({ error: 'Failed to link customer' }, { status: 500 });
        }
      } catch (dbError) {
        console.error('❌ Database error when linking customer:', dbError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    }

    // Create checkout session
    console.log('🛒 Creating checkout session for customer:', customerId);
    const session = await stripeService.createCheckoutSession(
      customerId,
      process.env.STRIPE_PRICE_ID!,
      `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
      `${process.env.NEXT_PUBLIC_APP_URL}/subscription/canceled`
    );

    console.log('✅ Created checkout session:', session.id);

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 