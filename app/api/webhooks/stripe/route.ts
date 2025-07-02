import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { DatabaseService, User } from '@/lib/mongodb';
import { StripeService } from '@/lib/stripe-service';
import Stripe from 'stripe';

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as an ArrayBuffer then convert to Buffer
    const buf = await request.arrayBuffer();
    const body = Buffer.from(buf);
    const signature = (await headers()).get('stripe-signature') as string;

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const stripeService = StripeService.getInstance();
    const dbService = DatabaseService.getInstance();

    let event: Stripe.Event;

    try {
      // Pass the Buffer directly to Stripe for signature verification
      event = stripeService.constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Received Stripe webhook:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, dbService);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription, dbService);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, dbService);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, dbService);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, dbService);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription, dbService: DatabaseService) {
  try {
    console.log('Processing subscription change:', subscription.id);
    
    const customerId = subscription.customer as string;
    console.log('Looking for user with customer ID:', customerId);
    
    // Find user by customer ID
    const user = await dbService.getUserByStripeCustomerId(customerId);
    if (!user) {
      console.error('User not found for customer ID:', customerId);
      // Log all users with stripe customer IDs for debugging
      await dbService.ensureConnection();
      const allUsers = await User.find({ stripeCustomerId: { $exists: true } }, 'clerkId stripeCustomerId email name').lean();
      console.log('All users with Stripe customer IDs:', allUsers);
      return;
    }

    console.log('Found user:', user.clerkId, user.email);
    
    // Safely convert timestamps to dates, handling undefined values
    const subscriptionData: any = {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
    };

    // Only add dates if they exist and are valid
    if ((subscription as any).current_period_end) {
      subscriptionData.subscriptionCurrentPeriodEnd = new Date(((subscription as any).current_period_end as number) * 1000);
    }
    
    if ((subscription as any).created) {
      subscriptionData.subscriptionCreatedAt = new Date(((subscription as any).created as number) * 1000);
    }
    
    if ((subscription as any).trial_end) {
      subscriptionData.trialEndsAt = new Date(((subscription as any).trial_end as number) * 1000);
    }

    console.log('Updating subscription with data:', subscriptionData);
    
    // Update subscription
    const updatedUser = await dbService.updateUserSubscriptionByCustomerId(
      customerId,
      subscriptionData
    );

    if (updatedUser) {
      console.log('Subscription updated successfully for user:', updatedUser.clerkId);
    } else {
      console.error('Failed to update subscription for customer:', customerId);
    }
  } catch (error) {
    console.error('Error handling subscription change:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, dbService: DatabaseService) {
  try {
    console.log('Processing subscription deletion:', subscription.id);
    
    const customerId = subscription.customer as string;
    
    // Option 2: Completely reset subscription data (now preferred)
    // This makes it easier for users to create new subscriptions without conflicts
    const subscriptionData: any = {
      stripeCustomerId: undefined, // Reset customer ID to allow fresh start
      stripeSubscriptionId: undefined,
      subscriptionStatus: undefined,
      subscriptionCurrentPeriodEnd: undefined,
      subscriptionCreatedAt: undefined,
      trialEndsAt: undefined,
    };

    const updatedUser = await dbService.updateUserSubscriptionByCustomerId(
      customerId,
      subscriptionData
    );

    if (updatedUser) {
      console.log('Subscription deletion processed successfully for user:', updatedUser.clerkId);
      console.log('✅ All subscription data reset - user can create fresh subscription');
    } else {
      console.error('User not found for customer ID during deletion:', customerId);
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, dbService: DatabaseService) {
  try {
    console.log('Processing successful payment for invoice:', invoice.id);
    
    if ((invoice as any).subscription) {
      const customerId = invoice.customer as string;
      
      const updatedUser = await dbService.updateUserSubscriptionByCustomerId(
        customerId,
        {
          subscriptionStatus: 'active',
        }
      );

      if (updatedUser) {
        console.log('Payment success processed for user:', updatedUser.clerkId);
      } else {
        console.error('User not found for customer ID during payment success:', customerId);
      }
    }

    console.log('Payment success processed');
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice, dbService: DatabaseService) {
  try {
    console.log('Processing failed payment for invoice:', invoice.id);
    
    if ((invoice as any).subscription) {
      const customerId = invoice.customer as string;
      
      const updatedUser = await dbService.updateUserSubscriptionByCustomerId(
        customerId,
        {
          subscriptionStatus: 'past_due',
        }
      );

      if (updatedUser) {
        console.log('Payment failure processed for user:', updatedUser.clerkId);
      } else {
        console.error('User not found for customer ID during payment failure:', customerId);
      }
    }

    console.log('Payment failure processed');
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, dbService: DatabaseService) {
  try {
    console.log('Processing checkout completion:', session.id);
    
    const customerId = session.customer as string;
    console.log('Checkout completion for customer ID:', customerId);
    
    // Find user to confirm the link exists
    const user = await dbService.getUserByStripeCustomerId(customerId);
    if (user) {
      console.log('Checkout completion confirmed for user:', user.clerkId, user.email);
    } else {
      console.error('User not found for customer ID during checkout completion:', customerId);
      
      // Log debugging info
      await dbService.ensureConnection();
      const allUsers = await User.find({ stripeCustomerId: { $exists: true } }, 'clerkId stripeCustomerId email name').lean();
      console.log('All users with Stripe customer IDs during checkout:', allUsers);
    }

    console.log('Checkout completion processed successfully');
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
} 