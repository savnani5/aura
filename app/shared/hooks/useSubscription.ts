'use client';

import { useSubscription as useSubscriptionContext } from '../contexts/SubscriptionContext';

// Re-export the context hook for backward compatibility
export function useSubscription() {
  return useSubscriptionContext();
} 