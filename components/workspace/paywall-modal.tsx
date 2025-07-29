'use client';

import React, { useState } from 'react';
import { X, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaywallModalProps {
  onClose: () => void;
  currentCount: number;
  limit: number;
}

export function PaywallModal({ onClose, currentCount, limit }: PaywallModalProps) {
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setUpgradeLoading(true);
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Zap size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Meeting Limit Reached</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-primary mb-2">
              {currentCount}/{limit}
            </div>
            <p className="text-muted-foreground">
              You've reached your monthly meeting limit on the free plan.
            </p>
          </div>

          {/* Upgrade Benefits */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-foreground mb-3">Upgrade to Pro and get:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">Unlimited meetings per month</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">AI-powered meeting summaries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">Advanced task management</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">Priority support</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleUpgrade}
              className="w-full gap-2"
              disabled={upgradeLoading}
            >
              {upgradeLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              {upgradeLoading ? 'Creating checkout...' : 'Upgrade to Pro'}
            </Button>
            
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Your limit will reset on the 1st of next month
          </p>
        </div>
      </div>
    </div>
  );
} 