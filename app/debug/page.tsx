'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { encodePassphrase, randomString } from '@/lib/client-utils';
import styles from '@/styles/Home.module.css';

export default function DebugPage() {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const serverUrl = formData.get('serverUrl');
    const token = formData.get('token');
    if (e2ee) {
      router.push(
        `/custom/?liveKitUrl=${serverUrl}&token=${token}#${encodePassphrase(sharedPassphrase)}`,
      );
    } else {
      router.push(`/custom/?liveKitUrl=${serverUrl}&token=${token}`);
    }
  };

  return (
    <main className={styles.main} data-lk-theme="default">
      <div className="header">
        <h1>Debug Connection</h1>
        <p style={{ color: '#666' }}>This page is for debugging purposes only.</p>
      </div>
      <form className={styles.tabContent} onSubmit={onSubmit}>
        <input
          id="serverUrl"
          name="serverUrl"
          type="url"
          placeholder="LiveKit Server URL: wss://*.livekit.cloud"
          required
        />
        <textarea
          id="token"
          name="token"
          placeholder="Token"
          required
          rows={5}
          style={{ padding: '1px 2px', fontSize: 'inherit', lineHeight: 'inherit' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
            <input
              id="use-e2ee"
              type="checkbox"
              checked={e2ee}
              onChange={(ev) => setE2ee(ev.target.checked)}
            ></input>
            <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
          </div>
          {e2ee && (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
              <label htmlFor="passphrase">Passphrase</label>
              <input
                id="passphrase"
                type="password"
                value={sharedPassphrase}
                onChange={(ev) => setSharedPassphrase(ev.target.value)}
              />
            </div>
          )}
        </div>

        <hr
          style={{ width: '100%', borderColor: 'rgba(255, 255, 255, 0.15)', marginBlock: '1rem' }}
        />
        <button
          style={{ paddingInline: '1.25rem', width: '100%' }}
          className="lk-button"
          type="submit"
        >
          Connect
        </button>
      </form>
    </main>
  );
} 