'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/app/subscription/hooks/useSubscription';
import { CheckCircle, ArrowRight } from 'lucide-react';

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

    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoaded, user, router]);

  // Separate effect for refetching subscription status - only run once
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    // Refetch subscription status to get latest data after payment
    refetch();
  }, [isLoaded, user, refetch]);

  const handleGoToWorkspace = () => {
    router.push('/');
  };

  if (!isLoaded || statusLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your subscription...</p>
          </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
            </div>

        {/* Main Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Ohm Pro!
        </h1>
        
        <p className="text-gray-600 mb-8">
          Your subscription has been activated successfully. You now have unlimited access to all premium features.
        </p>

        {/* Status Badge */}
        <div className="rounded-lg p-4 mb-8 border border-gray-200" style={{ backgroundColor: '#f9fafb', color: '#111827' }}>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: '#4b5563' }}>Status:</span>
            <span className="font-medium capitalize" style={{ color: '#111827' }}>
              {subscriptionStatus?.subscriptionStatus === 'trialing' ? 'Free Trial Active' : 'Active'}
            </span>
          </div>
          {subscriptionStatus?.subscriptionCurrentPeriodEnd && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span style={{ color: '#4b5563' }}>
                {subscriptionStatus?.subscriptionStatus === 'trialing' ? 'Trial ends:' : 'Next billing:'}
              </span>
              <span className="font-medium" style={{ color: '#111827' }}>
                {new Date(subscriptionStatus.subscriptionCurrentPeriodEnd).toLocaleDateString()}
              </span>
              </div>
            )}
              </div>

        {/* Features */}
        <div className="text-left rounded-lg p-6 mb-8 border border-gray-200" style={{ backgroundColor: '#f9fafb', color: '#111827' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#111827' }}>What's included:</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm" style={{ color: '#1f2937' }}>Unlimited meeting rooms</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm" style={{ color: '#1f2937' }}>Real-time AI transcription</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm" style={{ color: '#1f2937' }}>Smart meeting summaries</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm" style={{ color: '#1f2937' }}>Advanced task management</span>
            </li>
              </ul>
            </div>

        {/* Action Button */}
        <button 
          onClick={handleGoToWorkspace}
          className="w-full bg-black text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          Go to Workspace
          <ArrowRight className="w-4 h-4" />
              </button>

        {/* Auto-redirect message */}
        <p className="text-sm text-gray-500">
          Automatically redirecting to workspace in {countdown} seconds...
            </p>

        {/* Help text */}
        <p className="text-xs text-gray-400 mt-6">
          Need help? Contact us at support@tryohm.com
            </p>
          </div>
    </div>
  );
} 