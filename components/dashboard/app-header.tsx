'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';
import { useSubscription } from '@/app/shared/hooks/useSubscription';
import styles from '@/styles/AppHeader.module.css';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backHref?: string;
  showActions?: boolean;
  actionComponent?: React.ReactNode;
}

export function AppHeader({ 
  title, 
  subtitle,
  showBackButton = false,
  backHref = "/",
  showActions = true,
  actionComponent
}: AppHeaderProps) {
  const { hasActiveSubscription } = useSubscription();
  
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          {showBackButton && (
            <Link href={backHref} className={styles.backButton}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          )}
          
          <Link href="/" className={styles.logo}>
            <Image 
              src="/images/ohm-icon.svg" 
              alt="Ohm" 
              width={40} 
              height={40}
            />
            <h1>Ohm</h1>
          </Link>
          
          {title && (
            <div className={styles.titleSection}>
              <div className={styles.sectionBadge}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2"/>
                  <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{title}</h2>
                {subtitle && <p className={styles.sectionDescription}>{subtitle}</p>}
              </div>
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          {/* Navigation Links */}
          <nav className={styles.nav}>
            {hasActiveSubscription && (
              <Link href="/subscription/manage" className={styles.subscriptionButton}>
                Subscription
              </Link>
            )}
          </nav>

          {showActions && actionComponent && (
            <div className={styles.headerActions}>
              {actionComponent}
            </div>
          )}
          
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-10 h-10"
              }
            }}
          />
        </div>
      </div>
    </header>
  );
} 