'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import styles from '@/styles/HomePage.module.css';

export default function HomePage() {
  const { isSignedIn, isLoaded } = useUser();

  // Show loading while Clerk is initializing
  if (!isLoaded) {
  return (
    <div className={styles.container}>
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
          <p>Loading...</p>
        </div>
    </div>
  );
  }

  // Show appropriate component based on authentication status
  return isSignedIn ? <Dashboard /> : <LandingPage />;
}
