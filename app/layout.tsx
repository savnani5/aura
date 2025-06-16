import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export const metadata: Metadata = {
  title: 'Ohm',
  description: 'AI first Video Conferencing App',
  icons: {
    icon: '/images/ohm-icon.svg',
    shortcut: '/images/ohm-icon.svg',
    apple: '/images/ohm-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignInUrl="/"
      afterSignUpUrl="/"
      afterSignOutUrl="/"
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#8B5CF6',
          colorBackground: '#070707',
          colorInputBackground: '#1a1a1a',
          colorInputText: '#ffffff',
        }
      }}
    >
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
    </ClerkProvider>
  );
}
