import './globals.css';
// Import LiveKit styles only when needed, not globally
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { ClerkProvider } from '@clerk/nextjs';
import { SubscriptionProvider } from './subscription/contexts/SubscriptionContext';

export const metadata: Metadata = {
  title: 'Aura',
  description: 'AI-native video calls that turn every meeting into a searchable, sharable, actionable workspace',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: '32x32' }
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zoom on form inputs
  viewportFit: 'cover', // For iPhone X+ safe areas
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
