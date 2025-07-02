'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/app/components/AppHeader';
import { useSubscription } from '@/app/hooks/useSubscription';
import styles from '@/styles/subscription.module.css';

export default function SubscriptionSuccessPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const { subscriptionStatus, loading: statusLoading, hasActiveSubscription, refetch } = useSubscription();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    console.log('🎉 Payment success page loaded for user:', user.id);
    
    // Add a delay to give webhook time to process, then refetch subscription status
    const webhookDelay = setTimeout(() => {
      console.log('🔄 Refetching subscription status after webhook delay...');
      refetch();
    }, 3000); // 3 second delay

    return () => clearTimeout(webhookDelay);
  }, [isLoaded, user, router, refetch]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    // Auto-redirect timer (separate from countdown)
    const redirectTimer = setTimeout(() => {
      console.log('⏰ Auto-redirecting to dashboard...');
      router.push('/');
    }, 10000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [isLoaded, user, router]);

  // Debug subscription status changes
  useEffect(() => {
    console.log('📊 Subscription status updated:', {
      hasActiveSubscription,
      subscriptionStatus,
      loading: statusLoading
    });
  }, [hasActiveSubscription, subscriptionStatus, statusLoading]);

  const handleGoToDashboard = () => {
    console.log('🚀 Manually redirecting to dashboard...');
    router.push('/');
  };

  if (!isLoaded) {
    return (
      <div className={styles.container}>
        <AppHeader 
          title="Ohm Subscription" 
          subtitle="Payment processing..." 
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
    return null;
  }

  return (
    <div className={styles.container}>
      <AppHeader 
        title="Ohm Subscription" 
        subtitle="Welcome to your upgraded experience" 
        showActions={false}
      />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.resultCard}>
            <div className={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1>Welcome to Ohm!</h1>
            <p>
              Your subscription has been successfully activated. You now have access to all premium features 
              including unlimited meeting rooms, AI transcription, smart summaries, and advanced task management.
            </p>

            {statusLoading && (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Activating your subscription...</p>
              </div>
            )}

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                padding: '10px', 
                borderRadius: '4px', 
                fontSize: '12px',
                marginTop: '20px',
                fontFamily: 'monospace'
              }}>
                <div>Has Active Subscription: {hasActiveSubscription ? '✅' : '❌'}</div>
                <div>Status: {subscriptionStatus?.subscriptionStatus || 'null'}</div>
                <div>Loading: {statusLoading ? 'true' : 'false'}</div>
              </div>
            )}

            <div className={styles.nextSteps}>
              <h3>What&apos;s Next?</h3>
              <ul>
                <li>Start creating unlimited meeting rooms for your team</li>
                <li>Experience real-time AI transcription and summaries</li>
                <li>Use intelligent task management with AI insights</li>
                <li>Access your meeting history and searchable transcripts</li>
              </ul>
            </div>

            <div className={styles.actions}>
              <button onClick={handleGoToDashboard} className={styles.primaryButton}>
                Go to Dashboard
              </button>
              <Link href="/subscription" className={styles.secondaryButton}>
                Manage Billing
              </Link>
            </div>

            <p className={styles.autoRedirect}>
              Automatically redirecting to dashboard in {countdown} seconds...
            </p>

            <p className={styles.helpText}>
              Need help? Contact us at support@ohm.ai or check our documentation.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 