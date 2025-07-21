'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import styles from '@/styles/HomePage.module.css';

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const testimonials = [
    { company: 'Snapchat', logo: '/images/snapchat.png' },
    { company: 'Wordware', logo: '/images/wordware.png' },
    { company: 'Workday', logo: '/images/workday.png' },
    { company: 'Uber', logo: '/images/uber.png' },
    { company: 'Meta', logo: '/images/meta.png' },
  ];

  const gettingStartedSteps = [
    {
      time: '30 seconds',
      title: 'Create a meeting',
      description: 'Set up your meeting room with a single click'
    },
    {
      time: '30 minutes',
      title: 'Jump on call with your ohm copilot',
      description: 'Your AI assistant joins the call and starts helping immediately'
    },
    {
      time: '1 hour',
      title: 'Hop off with all your to-dos tracked',
      description: 'All tasks drafted and ready for you to action'
    }
  ];

  const productStages = [
    {
      title: 'Prep the meeting',
      description: 'No more late nights scouring transcripts or writing dozens of updates messages. Use Ohm to receive a daily brief every morning on that day\'s meeting agenda',
      icon: '📋'
    },
    {
      title: 'Running the meeting',
      description: 'With your own meeting assistant built into our personalized video conferencing platform, you\'ll never need to leave the meeting. Just ask Ohm to get information on the current meeting, previous meetings, or search web.',
      icon: '🎥'
    },
    {
      title: 'After the meeting',
      description: 'Everyone on the call will receive post meeting summaries, your to-dos are automatically tracked, and your meeting transcript is stored in one place for you to chat with.',
      icon: '📝'
    },
    {
      title: 'Integrations',
      description: 'Never worry about loose ends again. Ohm helps you send messages in Slack and email. If you already have task management tools in place, Ohm integrates seamlessly to stay in sync at all times with your team.',
      icon: '🔗'
    }
  ];

  const faqItems = [
    {
      question: 'How does Ohm work?',
      answer: 'Ohm has a native video conferencing platform that transcribes conversations in real-time, takes notes, and tracks action items automatically.'
    },
    {
      question: 'Which tools does Ohm replace?',
      answer: 'Meeting recording software, transcription services, note-taking apps, and task management tools.'
    },
    {
      question: 'What is Ohm\'s refund policy?',
      answer: '30-day free trial, cancel anytime. No refunds after billing, but you keep access for the full billing cycle.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes. All data is encrypted and we never share your meeting data with third parties.'
    },
    {
      question: 'Can I use Ohm with existing video conferencing tools?',
      answer: 'Currently Ohm has its own video platform. Integrations with other tools are coming soon.'
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

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
              Your AI meeting 
              <span className={styles.gradientText}> Copilot</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ohm is the only all-in-one AI copilot trained by top COOs and managers to handle all the tedious parts of meetings
            </p>
            <div className={styles.heroActions}>
              <SignUpButton mode="modal">
                <button className={styles.primaryButton}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                  </svg>
                  Get 30 day free trial
                </button>
              </SignUpButton>
              <button className={styles.secondaryButton}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Book Demo
              </button>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.videoContainer}>
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/zTxVDaxxTmg"
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

      {/* Testimonials Section */}
      <section className={styles.testimonialsSection}>
        <div className={styles.testimonialsContent}>
          <p className={styles.testimonialsTitle}>Trusted by operators from</p>
          <div className={styles.testimonialsGrid}>
            {testimonials.map((testimonial, index) => (
              <div key={index} className={styles.testimonialItem}>
                <Image
                  src={testimonial.logo}
                  alt={`${testimonial.company} logo`}
                  width={60}
                  height={30}
                  className={styles.companyLogo}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className={styles.gettingStartedSection}>
        <div className={styles.gettingStartedContent}>
          <h2 className={styles.sectionTitle}>Getting Started Takes Seconds</h2>
          <div className={styles.stepsGrid}>
            {gettingStartedSteps.map((step, index) => (
              <div key={index} className={styles.stepCard}>
                <div className={styles.stepTime}>{step.time}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Stages Section */}
      <section className={styles.productStagesSection}>
        <div className={styles.productStagesContent}>
          <h2 className={styles.sectionTitle}>Complete Meeting Workflow</h2>
          <div className={styles.featuresGrid}>
            {productStages.map((stage, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>{stage.icon}</div>
                <h3 className={styles.featureTitle}>{stage.title}</h3>
                <p className={styles.featureDescription}>{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={styles.pricingSection}>
        <div className={styles.pricingContent}>
          <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
          <p className={styles.pricingSubtitle}>Start with a 30-day free trial, cancel anytime.</p>
          
          <div className={styles.pricingCard}>
            <div className={styles.pricingHeader}>
              <h3 className={styles.planName}>Pro Plan</h3>
              <div className={styles.priceDisplay}>
                <span className={styles.price}>$25</span>
                <span className={styles.period}>/month</span>
              </div>
            </div>
            <ul className={styles.featuresList}>
              <li>Real-time transcription</li>
              <li>Smart AI meeting assistant</li>
              <li>AI-powered meeting summaries</li>
              <li>Task tracking and management</li>
              <li>Slack & Email integrations</li>
              <li>Priority support</li>
            </ul>
            <SignUpButton mode="modal">
              <button className={styles.pricingButton}>
                Start 30-Day Free Trial
              </button>
            </SignUpButton>
            <p className={styles.trialNote}>Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.faqSection}>
        <div className={styles.faqContent}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {faqItems.map((item, index) => (
              <div key={index} className={styles.faqItem}>
                <button 
                  className={styles.faqQuestion}
                  onClick={() => toggleFaq(index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{item.question}</span>
                  <svg 
                    className={`${styles.faqIcon} ${openFaq === index ? styles.faqIconOpen : ''}`}
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className={`${styles.faqAnswer} ${openFaq === index ? styles.faqAnswerOpen : ''}`}>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className={styles.finalCtaSection}>
        <div className={styles.finalCtaContent}>
          <h2 className={styles.finalCtaTitle}>Ready to transform your meetings?</h2>
          <p className={styles.finalCtaSubtitle}>Join thousands of teams already using Ohm to make their meetings more productive</p>
          <div className={styles.finalCtaActions}>
            <SignUpButton mode="modal">
              <button className={styles.primaryButton}>
                Get 30 day free trial
              </button>
            </SignUpButton>
            <button className={styles.secondaryButton}>
              Book Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
} 