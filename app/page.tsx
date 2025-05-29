'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

function DemoMeeting() {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <img src="/images/ohm-icon.svg" alt="Ohm Logo" />
        </div>
        <h1 className={styles.title}>Welcome to Ohm</h1>
        <p className={styles.subtitle}>
        AI first Video Confereing App
        </p>
      </div>

      {/* Main Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 16.92V7.08C21.9996 6.71 21.8947 6.35 21.6985 6.04C21.5023 5.73 21.2235 5.48 20.8962 5.32L13.4462 1.32C13.1589 1.18 12.8394 1.11 12.5162 1.11C12.193 1.11 11.8735 1.18 11.5862 1.32L4.13619 5.32C3.80888 5.48 3.53013 5.73 3.33393 6.04C3.13773 6.35 3.03284 6.71 3.03247 7.08V16.92C3.03284 17.29 3.13773 17.65 3.33393 17.96C3.53013 18.27 3.80888 18.52 4.13619 18.68L11.5862 22.68C11.8735 22.82 12.193 22.89 12.5162 22.89C12.8394 22.89 13.1589 22.82 13.4462 22.68L20.8962 18.68C21.2235 18.52 21.5023 18.27 21.6985 17.96C21.8947 17.65 21.9996 17.29 22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7.5,4.21 12,6.81 16.5,4.21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7.5,19.79 7.5,14.6 3,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="21,12 16.5,14.6 16.5,19.79" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Start New Meeting</h2>
            <p className={styles.cardDescription}>Create an instant video conference room</p>
          </div>
        </div>

        <div className={styles.cardContent}>
          {/* Start Meeting Button */}
          <button className={styles.primaryButton} onClick={startMeeting}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
            Start Meeting Now
          </button>

          {/* Security Options */}
          <div className={styles.securitySection}>
            <div className={styles.securityHeader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.securityTitle}>Security Options</span>
            </div>

            <div className={styles.checkbox}>
              <input
                id="use-e2ee"
                type="checkbox"
                checked={e2ee}
                onChange={(ev) => setE2ee(ev.target.checked)}
                className={styles.checkboxInput}
              />
              <label htmlFor="use-e2ee" className={styles.checkboxLabel}>
                <div className={styles.checkboxIcon}>
                  {e2ee && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className={styles.checkboxContent}>
                  <span className={styles.checkboxTitle}>End-to-end encryption</span>
                  <span className={styles.checkboxDescription}>Secure your meeting with advanced encryption</span>
                </div>
              </label>
            </div>

            {e2ee && (
              <div className={styles.passphraseSection}>
                <label htmlFor="passphrase" className={styles.inputLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Encryption Passphrase
                </label>
                <input
                  id="passphrase"
                  type="password"
                  value={sharedPassphrase}
                  onChange={(ev) => setSharedPassphrase(ev.target.value)}
                  className={styles.passphraseInput}
                  placeholder="Enter your encryption passphrase"
                />
                <div className={styles.inputHelper}>
                  Share this passphrase with meeting participants for secure access
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.featureContent}>
              <span className={styles.featureTitle}>Real-time Transcription</span>
              <span className={styles.featureDescription}>Automatic speech-to-text for all participants</span>
            </div>
          </div>

          <div className={styles.feature}>
            <div className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className={styles.featureContent}>
              <span className={styles.featureTitle}>Personal Notes</span>
              <span className={styles.featureDescription}>Take private notes during the meeting</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className={styles.main} data-lk-theme="default">
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <DemoMeeting />
      </Suspense>
    </main>
  );
}
