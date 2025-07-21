'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MeetingStatusPageProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingStatusPage({ params }: MeetingStatusPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [meetingId, setMeetingId] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'active' | 'generating_summary' | 'completed' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>('');

  // Resolve params
  useEffect(() => {
    params.then(({ meetingId }) => {
      setMeetingId(meetingId);
      setRoomName(searchParams.get('roomName') || '');
    });
  }, [params, searchParams]);

  // Poll meeting status
  useEffect(() => {
    if (!meetingId || !roomName) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/meetings/${roomName}/status?meetingId=${meetingId}`);
        
        if (!response.ok) {
          throw new Error('Failed to check meeting status');
        }

        const data = await response.json();
        
        if (data.success) {
          const newStatus = data.data.status;
          setStatus(newStatus);
          
          if (newStatus === 'completed') {
            // Redirect to summary page
            router.push(`/meeting-summary/${meetingId}`);
          }
        } else {
          setError(data.error || 'Unknown error');
          setStatus('error');
        }
      } catch (err) {
        console.error('Error checking meeting status:', err);
        setError('Failed to check meeting status');
        setStatus('error');
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 3 seconds
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [meetingId, roomName, router]);

  if (!meetingId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h1>Invalid Meeting</h1>
        <p>No meeting ID provided.</p>
        <Link href="/" style={{ color: '#0066cc', textDecoration: 'underline' }}>
          Go back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        textAlign: 'center'
      }}>
        <div style={{ 
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
            Meeting Status
          </h1>
        </div>
        
        <div style={{ padding: '3rem 2rem' }}>
          {status === 'loading' && (
            <div>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }} />
              <h2 style={{ margin: '0 0 1rem', color: '#333' }}>Checking meeting status...</h2>
            </div>
          )}

          {status === 'active' && (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎥</div>
              <h2 style={{ margin: '0 0 1rem', color: '#333' }}>Meeting Still Active</h2>
              <p style={{ color: '#666', marginBottom: '2rem' }}>
                Other participants are still in the meeting. You can rejoin or wait for the meeting to end.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => router.push(`/rooms/${roomName}`)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Rejoin Meeting
                </button>
                <Link 
                  href="/" 
                  style={{ 
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    color: '#667eea',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    fontWeight: '500',
                    textDecoration: 'none'
                  }}
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          )}

          {status === 'generating_summary' && (
            <div>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }} />
              <h2 style={{ margin: '0 0 1rem', color: '#333' }}>Generating Summary</h2>
              <p style={{ color: '#666', marginBottom: '2rem' }}>
                The meeting has ended and we&apos;re generating your AI summary. This usually takes 30-60 seconds.
              </p>
              <div style={{ 
                background: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '2rem'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                  ✨ AI is analyzing transcripts and generating insights...
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>❌</div>
              <h2 style={{ margin: '0 0 1rem', color: '#333' }}>Error</h2>
              <p style={{ color: '#666', marginBottom: '2rem' }}>
                {error || 'Something went wrong while checking the meeting status.'}
              </p>
              <Link 
                href="/" 
                style={{ 
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
              >
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 