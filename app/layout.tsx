import './globals.css';
// Import LiveKit styles only when needed, not globally
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { ClerkProvider } from '@clerk/nextjs';
import { SubscriptionProvider } from './subscription/contexts/SubscriptionContext';

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
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignInUrl="/"
      afterSignUpUrl="/"
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#0a0a0a',
          colorBackground: '#ffffff',
          colorInputBackground: '#f8f9fa',
          colorInputText: '#0a0a0a',
          colorText: '#0a0a0a',
          colorTextSecondary: '#6c757d',
          colorNeutral: '#ffffff',
          borderRadius: '0.5rem',
        },
        elements: {
          formButtonPrimary: 'bg-black hover:bg-gray-800 text-white',
          card: 'bg-white border border-gray-200 shadow-sm',
          headerTitle: 'text-black',
          headerSubtitle: 'text-gray-600',
          socialButtonsBlockButton: 'bg-white border border-gray-200 text-black hover:bg-gray-50',
          formFieldInput: 'bg-gray-50 border-gray-200 text-black',
          footerActionLink: 'text-black hover:text-gray-700',
        }
      }}
    >
    <html lang="en">
      <body className="bg-white">
        <SubscriptionProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#0a0a0a',
                border: '1px solid #dee2e6',
              },
            }}
          />
          {children}
        </SubscriptionProvider>
      </body>
    </html>
    </ClerkProvider>
  );
}
