'use client';

import React, { useEffect, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { LandingPage } from '@/components/landing';
import { SimplifiedDashboard } from '@/components/workspace/simplified-dashboard';

function ReferralTracker() {
  const searchParams = useSearchParams();

  // Handle referral tracking on landing page
  useEffect(() => {
    const referralCode = searchParams.get('ref');
    if (referralCode) {
      // Store referral code in localStorage for later use when user signs up
      localStorage.setItem('ohm_referral', referralCode);
      console.log('Stored referral code from landing page:', referralCode);
      
      // Optional: Clean URL by removing the ref parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  return null; // This component doesn't render anything
}

export default function HomePage() {
  const { isSignedIn, isLoaded } = useUser();

  // Show loading while Clerk is initializing - consistent with workspace theme
  if (!isLoaded) {
  return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
  }

  // Show appropriate component based on authentication status
  return (
    <>
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>
      {isSignedIn ? <SimplifiedDashboard /> : <LandingPage />}
    </>
  );
}
