'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useSubscription } from './useSubscription';

export function useSubscriptionGuard() {
  const { user, isLoaded } = useUser();
  const { hasActiveSubscription, loading } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if user is loaded and we have subscription status
    if (isLoaded && user && !loading) {
      if (!hasActiveSubscription) {
        router.push('/subscription');
      }
    }
  }, [isLoaded, user, hasActiveSubscription, loading, router]);

  return {
    isLoading: !isLoaded || loading,
    hasAccess: hasActiveSubscription,
    user,
  };
} 