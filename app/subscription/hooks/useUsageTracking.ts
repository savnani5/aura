'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsageData {
  plan: 'free' | 'pro';
  unlimited: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

interface UseUsageTrackingReturn {
  usageData: UsageData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  checkBeforeMeeting: () => Promise<boolean>; // Returns true if user can start meeting
}

export function useUsageTracking(): UseUsageTrackingReturn {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/subscription/usage');
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }
      
      const data = await response.json();
      if (data.success) {
        setUsageData(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch usage data');
      }
    } catch (err) {
      console.error('Error fetching usage data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBeforeMeeting = useCallback(async (): Promise<boolean> => {
    // Refresh usage data before checking
    await fetchUsageData();
    
    // If we have current data, check if user can start meeting
    if (usageData) {
      return !usageData.exceeded || usageData.unlimited;
    }
    
    // If no data available, allow (fail open)
    return true;
  }, [fetchUsageData, usageData]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  return {
    usageData,
    loading,
    error,
    refetch: fetchUsageData,
    checkBeforeMeeting
  };
} 