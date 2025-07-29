'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionCurrentPeriodEnd?: string;
  stripeCustomerId?: string;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  hasActiveSubscription: boolean;
  isTrialing: boolean;
  isActive: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Cache subscription status for 30 seconds to prevent excessive API calls
  const CACHE_DURATION = 30000; // 30 seconds

  useEffect(() => {
    if (isLoaded && user) {
      checkSubscriptionStatus();
    } else if (isLoaded && !user) {
      // User is not logged in
      setLoading(false);
      setSubscriptionStatus({ hasActiveSubscription: false });
    }
  }, [isLoaded, user]);

  const checkSubscriptionStatus = async (force = false) => {
    try {
      const now = Date.now();
      
      // Use cache if recent and not forced
      if (!force && subscriptionStatus && (now - lastFetch) < CACHE_DURATION) {
        return;
      }

      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/subscription/status');
      
      if (response.ok) {
        const status = await response.json();
        setSubscriptionStatus(status);
        setLastFetch(now);
      } else {
        const errorData = await response.text();
        console.error('❌ Subscription status error:', response.status, errorData);
        throw new Error(`Failed to fetch subscription status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
      setError('Failed to load subscription status');
      setSubscriptionStatus({ hasActiveSubscription: false });
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      // Use custom portal URL from environment variable
      const portalUrl = process.env.NEXT_PUBLIC_CUSTOMER_PORTAL;
      
      if (portalUrl) {
        window.location.href = portalUrl;
      } else {
        // Fallback to Stripe portal if custom URL not set
        const response = await fetch('/api/subscription/portal', {
          method: 'POST',
        });
        
        if (response.ok) {
          const { url } = await response.json();
          window.location.href = url;
        } else {
          throw new Error('Failed to open customer portal');
        }
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  const refetch = useCallback(() => checkSubscriptionStatus(true), []);

  const value: SubscriptionContextType = {
    subscriptionStatus,
    loading,
    error,
    refetch,
    openCustomerPortal,
    hasActiveSubscription: subscriptionStatus?.hasActiveSubscription ?? false,
    isTrialing: subscriptionStatus?.subscriptionStatus === 'trialing',
    isActive: subscriptionStatus?.subscriptionStatus === 'active',
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
} 