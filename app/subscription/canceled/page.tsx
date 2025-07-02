'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/app/components/AppHeader';
import styles from '@/styles/subscription.module.css';

export default function SubscriptionCanceledPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/subscription');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className={styles.container}>
        <AppHeader 
          title="Ohm Pro" 
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
        title="Ohm Pro" 
        subtitle="Payment was canceled" 
        showActions={false}
      />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.resultCard}>
            <div className={styles.cancelIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>

            <h1>Payment Canceled</h1>
            <p>
              No worries! Your payment was canceled and no charges were made. 
              You can still try Ohm Pro when you&apos;re ready.
            </p>

            <div className={styles.nextSteps}>
              <h3>What You Can Do:</h3>
              <ul>
                <li>Continue using Ohm with basic features</li>
                <li>Try the subscription again anytime</li>
                <li>Contact support if you had technical issues</li>
                <li>Learn more about Ohm Pro features</li>
              </ul>
            </div>

            <div className={styles.actions}>
              <Link href="/subscription" className={styles.primaryButton}>
                Try Ohm Pro Again
              </Link>
              <Link href="/" className={styles.secondaryButton}>
                Continue with Basic
              </Link>
            </div>

            <p className={styles.autoRedirect}>
              Automatically redirecting to subscription page in {countdown} seconds...
            </p>

            <p className={styles.helpText}>
              Having issues? Contact us at support@ohm.ai - we&apos;re here to help!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 