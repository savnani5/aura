'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { AppHeader } from '@/app/components/AppHeader';
import { useSubscription } from '@/app/hooks/useSubscription';
import styles from '@/styles/subscription.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function SubscriptionPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { subscriptionStatus, loading: statusLoading, hasActiveSubscription, openCustomerPortal } = useSubscription();

  useEffect(() => {
    if (isLoaded && user && hasActiveSubscription) {
      // If user already has active subscription, redirect to dashboard
      router.push('/');
    }
  }, [isLoaded, user, hasActiveSubscription, router]);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
      
    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('Failed to start subscription process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || statusLoading) {
    return (
      <div className={styles.container}>
        <AppHeader 
          showActions={false}
        />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className={styles.container}>
      <AppHeader 
        showActions={false}
      />

      <main className={styles.main}>
        <div className={styles.content}>
          {hasActiveSubscription ? (
            /* Subscription Management View */
            <div className={styles.managementCard}>
              <div className={styles.statusHeader}>
                <div className={styles.statusIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3>Active Subscription</h3>
                  <p>You have access to all Ohm features</p>
                </div>
              </div>

              <div className={styles.subscriptionDetails}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Status</span>
                  <span className={`${styles.detailValue} ${styles.statusActive}`}>
                    {subscriptionStatus?.subscriptionStatus === 'trialing' ? '30-Day Trial' : 'Active'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Plan</span>
                  <span className={styles.detailValue}>Ohm Subscription - $25/month</span>
                </div>
              </div>

              <div className={styles.managementActions}>
                <button 
                  onClick={openCustomerPortal}
                  className={styles.portalButton}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Manage Billing
                </button>
                <p className={styles.portalDescription}>
                  Update payment method, view invoices, and cancel subscription
                </p>
              </div>
            </div>
          ) : (
            /* Subscription Signup View */
            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <h3>Ohm Subscription</h3>
                <div className={styles.price}>
                  <span className={styles.amount}>$25</span>
                  <span className={styles.period}>/month</span>
                </div>
                <p className={styles.trial}>30-day free trial included</p>
              </div>

              <div className={styles.features}>
                <h4>Everything you need for productive meetings:</h4>
                <ul className={styles.featureList}>
                  <li>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Unlimited meeting rooms and participants
                  </li>
                  <li>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Real-time transcription and meeting summaries
                  </li>
                  <li>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    AI chat with meeting context and history
                  </li>
                  <li>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Smart task management and tracking
                  </li>
                  <li>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Persistent context across recurring meetings
                  </li>
                </ul>
              </div>

              <div className={styles.actions}>
                <button 
                  onClick={handleSubscribe}
                  disabled={loading}
                  className={styles.subscribeButton}
                >
                  {loading ? (
                    <>
                      <div className={styles.buttonSpinner}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Start Free Trial
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
                <p className={styles.trialInfo}>
                  No commitment. Cancel anytime during your trial.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 