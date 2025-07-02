'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/app/components/AppHeader';
import { useSubscription } from '@/app/hooks/useSubscription';
import styles from '@/styles/subscription.module.css';

export default function ManageSubscriptionPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { subscriptionStatus, loading, hasActiveSubscription, openCustomerPortal } = useSubscription();

  if (!isLoaded || loading) {
    return (
      <div className={styles.container}>
        <AppHeader 
          showActions={false}
        />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading subscription details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className={styles.container}>
      <AppHeader 
        showActions={false}
      />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.managementCard}>
            {/* Subscription Status */}
            <div className={styles.statusSection}>
              <div className={styles.statusHeader}>
                <h2>Subscription Management</h2>
                <div className={`${styles.statusBadge} ${hasActiveSubscription ? styles.active : styles.inactive}`}>
                  {hasActiveSubscription ? (
                    subscriptionStatus?.subscriptionStatus === 'trialing' ? 'Free Trial' : 'Active'
                  ) : 'Inactive'}
                </div>
              </div>

              {hasActiveSubscription ? (
                <div className={styles.subscriptionDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Price:</span>
                    <span className={styles.detailValue}>$25.00/month</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Status:</span>
                    <span className={styles.detailValue}>
                      {subscriptionStatus?.subscriptionStatus === 'trialing' ? 'Free Trial' : 'Active Subscription'}
                    </span>
                  </div>
                  {subscriptionStatus?.subscriptionStatus === 'trialing' && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Trial Ends:</span>
                      <span className={styles.detailValue}>
                        {formatDate(subscriptionStatus.trialEndsAt)}
                      </span>
                    </div>
                  )}
                  {subscriptionStatus?.subscriptionStatus === 'active' && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Next Billing:</span>
                      <span className={styles.detailValue}>
                        {formatDate(subscriptionStatus.subscriptionCurrentPeriodEnd)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.inactiveMessage}>
                  <p>You don&apos;t have an active subscription. Subscribe to access Ohm Pro features.</p>
                </div>
              )}
            </div>

            {/* Features */}
            <div className={styles.featuresSection}>
              <h3>Ohm Pro Features</h3>
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Unlimited meeting rooms and persistent workspaces</span>
                </div>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Real-time AI transcription and speaker diarization</span>
                </div>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>AI-powered meeting summaries and insights</span>
                </div>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Smart task management with AI suggestions</span>
                </div>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Meeting history and searchable transcripts</span>
                </div>
                <div className={styles.featureItem}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Priority customer support</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actionsSection}>
              {hasActiveSubscription ? (
                <div className={styles.subscribedActions}>
                  <button 
                    onClick={openCustomerPortal}
                    className={styles.primaryButton}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Manage Billing
                  </button>
                  <button 
                    onClick={() => router.push('/')}
                    className={styles.secondaryButton}
                  >
                    Back to Workspaces
                  </button>
                </div>
              ) : (
                <div className={styles.unsubscribedActions}>
                  <button 
                    onClick={() => router.push('/subscription')}
                    className={styles.primaryButton}
                  >
                    Start Free Trial
                  </button>
                  <button 
                    onClick={() => router.push('/')}
                    className={styles.secondaryButton}
                  >
                    Back to Workspaces
                  </button>
                </div>
              )}
            </div>

            {/* Help */}
            <div className={styles.helpSection}>
              <p className={styles.helpText}>
                Need help? Contact us at <a href="mailto:support@tryohm.com">support@tryohm.com</a>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 