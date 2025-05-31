'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState, useEffect } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import styles from '../styles/Home.module.css';

function DemoMeeting() {
  const router = useRouter();
  const [sharedPassphrase, setSharedPassphrase] = useState('');
  const [e2ee, setE2ee] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Detect mobile devices
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
      setIsClient(true);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        paragraph: {
          HTMLAttributes: {
            class: 'my-2',
          },
        },
      }),
      Placeholder.configure({
        placeholder: 'type something...',
        emptyEditorClass: 'is-empty',
      }),
    ],
    content: '<p></p>',
    editable: true,
    autofocus: false,
    editorProps: {
      attributes: {
        style: 'outline: none !important; border: none !important; color: #363636 !important; font-size: 14px !important; line-height: 1.5 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; flex: 1 !important; background: transparent !important; box-shadow: none !important;'
      }
    }
  });

  useEffect(() => {
    if (isClient && !isMobile && editor) {
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  }, [isClient, isMobile, editor]);

  const handleNotepadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.notepadHeader')) {
      return;
    }
    
    if (isMobile) {
      return;
    }
    
    if (editor) {
      editor.commands.focus();
    }
  };
  
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  return (
    <div className={styles.paperContainer}>
      {/* Left Panel - Meeting Setup */}
      <div className={styles.leftPanel}>
        <div className={styles.paperCard}>
          {/* Header */}
          <div className={styles.paperHeader}>
            <div className={styles.logoSection}>
              <img src="/images/ohm-icon.svg" alt="Ohm Logo" className={styles.logo} />
              <div>
                <h1 className={styles.paperTitle}>Start Meeting</h1>
                <p className={styles.paperSubtitle}>Create your video conference</p>
              </div>
            </div>
          </div>

          {/* Start Meeting Button */}
          <button className={styles.startButton} onClick={startMeeting}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
            Start Meeting Now
          </button>

          {/* Security Options */}
          <div className={styles.paperSection}>
            <div className={styles.sectionHeader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.sectionTitle}>Security Options</span>
            </div>

            <div className={styles.paperCheckbox}>
              <input
                id="use-e2ee"
                type="checkbox"
                checked={e2ee}
                onChange={(ev) => setE2ee(ev.target.checked)}
                className={styles.checkboxInput}
              />
              <label htmlFor="use-e2ee" className={styles.paperCheckboxLabel}>
                <div className={styles.paperCheckboxIcon}>
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
              <div className={styles.paperPassphraseSection}>
                <label htmlFor="passphrase" className={styles.paperInputLabel}>
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
                  className={styles.paperInput}
                  placeholder="Enter your encryption passphrase"
                />
                <div className={styles.inputHelper}>
                  Share this passphrase with meeting participants for secure access
                </div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className={styles.paperFeatures}>
            <h3 className={styles.featuresTitle}>Features</h3>
            <div className={styles.featuresList}>
              <div className={styles.paperFeature}>
                <div className={styles.paperFeatureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className={styles.paperFeatureContent}>
                  <span className={styles.paperFeatureTitle}>Real-time Transcription</span>
                  <span className={styles.paperFeatureDescription}>Automatic speech-to-text for all participants</span>
                </div>
              </div>

              <div className={styles.paperFeature}>
                <div className={styles.paperFeatureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <div className={styles.paperFeatureContent}>
                  <span className={styles.paperFeatureTitle}>Personal Notes</span>
                  <span className={styles.paperFeatureDescription}>Take private notes during the meeting</span>
                </div>
              </div>

              <div className={styles.paperFeature}>
                <div className={styles.paperFeatureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="17" r="1" fill="currentColor"/>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <div className={styles.paperFeatureContent}>
                  <span className={styles.paperFeatureTitle}>AI Assistant</span>
                  <span className={styles.paperFeatureDescription}>Ask questions about the meeting</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Notepad */}
      <div className={styles.rightPanel}>
        <div className={styles.notepadCard} onClick={handleNotepadClick}>
          <div className={styles.notepadHeader}>
            <h2 className={styles.notepadTitle}>Meeting Notes</h2>
            <p className={styles.notepadSubtitle}>Detailed agendas can slash meeting duration by up to 80%.</p>
          </div>

          {editor && (
            <EditorContent 
              editor={editor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className={styles.paperMain} data-lk-theme="default" style={{ margin: 0, padding: 0 }}>
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <DemoMeeting />
      </Suspense>
    </main>
  );
}
