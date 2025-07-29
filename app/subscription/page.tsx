'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main dashboard since billing is now handled through the modal
    router.replace('/');
  }, [router]);

    return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-gray-600">Redirecting to workspace...</p>
      </div>
    </div>
  );
} 