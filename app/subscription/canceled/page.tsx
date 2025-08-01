'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { XCircle, ArrowLeft } from 'lucide-react';

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

  const handleGoToWorkspace = () => {
    router.push('/');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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
        {/* Cancel Icon */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-gray-600" />
          </div>
            </div>

        {/* Main Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Payment Canceled
        </h1>
        
        <p className="text-gray-600 mb-8">
              No worries! Your payment was canceled and no charges were made. 
          You can continue using Aura with the free plan.
            </p>

                {/* Free Plan Features */}
        <div className="text-left rounded-lg p-6 mb-8" style={{ backgroundColor: '#f9fafb', color: '#111827' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#111827' }}>Free plan includes:</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-400 rounded-full flex-shrink-0"></div>
              <span className="text-sm" style={{ color: '#1f2937' }}>10 meetings per month</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-400 rounded-full flex-shrink-0"></div>
              <span className="text-sm" style={{ color: '#1f2937' }}>Basic meeting summaries</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-400 rounded-full flex-shrink-0"></div>
              <span className="text-sm" style={{ color: '#1f2937' }}>Community support</span>
            </li>
              </ul>
            </div>

        {/* Action Button */}
        <button 
          onClick={handleGoToWorkspace}
          className="w-full bg-black text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Continue to Workspace
        </button>

        {/* Auto-redirect message */}
        <p className="text-sm text-gray-500">
          Automatically redirecting to workspace in {countdown} seconds...
            </p>

        {/* Help text */}
        <p className="text-xs text-gray-400 mt-6">
          Want to upgrade later? You can always subscribe from your workspace settings.
            </p>
          </div>
    </div>
  );
} 