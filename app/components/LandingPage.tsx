'use client';

import React from 'react';
import Image from 'next/image';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import styles from '@/styles/HomePage.module.css';

export function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <Image 
              src="/images/ohm-icon.svg" 
              alt="Ohm" 
              width={40} 
              height={40}
            />
            <h1>Ohm</h1>
          </div>
          <div className={styles.authButtons}>
            <SignInButton mode="modal">
              <button className={styles.signInButton}>
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={styles.signUpButton}>
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              AI-First Video
              <span className={styles.gradientText}> Conferencing</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Smart meetings with real-time transcription, personalized notes, 
              and AI-powered insights. Transform how your team collaborates.
            </p>
            <div className={styles.heroActions}>
              <SignUpButton mode="modal">
                <button className={styles.primaryButton}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                  </svg>
                  Get Started
                </button>
              </SignUpButton>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.videoContainer}>
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/lAkS0F3CZFQ"
                title="Ohm AI Product Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className={styles.demoVideo}
              ></iframe>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 