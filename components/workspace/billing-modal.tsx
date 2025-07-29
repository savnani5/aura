'use client';

import React, { useState } from 'react';
import { X, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/app/subscription/hooks/useSubscription';
import { useUsageTracking } from '@/app/subscription/hooks/useUsageTracking';

interface BillingModalProps {
  onClose: () => void;
}

export function BillingModal({ onClose }: BillingModalProps) {
  const { subscriptionStatus, hasActiveSubscription, openCustomerPortal, loading } = useSubscription();
  const { usageData, loading: usageLoading } = useUsageTracking();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleManageBilling = async () => {
    await openCustomerPortal();
  };

  const handleUpgradeToPro = async () => {
    try {
      setUpgradeLoading(true);
      
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json();
      
      // Redirect directly to Stripe Checkout
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
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Billing</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-muted rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-foreground">Current Plan</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveSubscription ? 'Pro Plan' : 'Free Plan'}
                  </p>
                </div>
                <span className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full",
                  hasActiveSubscription 
                    ? "bg-green-100 text-green-800" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {hasActiveSubscription ? 'Active' : 'Free'}
                </span>
              </div>
              
              {hasActiveSubscription ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-foreground capitalize">
                      {subscriptionStatus?.subscriptionStatus || 'Active'}
                    </span>
                  </div>
                  {subscriptionStatus?.subscriptionCurrentPeriodEnd && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Renews on:</span>
                      <span className="text-foreground">
                        {new Date(subscriptionStatus.subscriptionCurrentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      You have unlimited access to all features.
                    </p>
                  </div>
                </div>
                                   ) : (
                       <div className="space-y-3">
                         <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground">Monthly meetings:</span>
                           <span className="text-foreground">
                             {usageLoading ? 'Loading...' : usageData ? `${usageData.currentCount}/${usageData.limit}` : '0/10'}
                           </span>
                         </div>
                         {usageData && (
                           <div className="flex items-center justify-between text-sm">
                             <span className="text-muted-foreground">Remaining:</span>
                             <span className={cn(
                               "text-foreground font-medium",
                               usageData.remaining <= 2 && "text-orange-600",
                               usageData.remaining === 0 && "text-red-600"
                             )}>
                               {usageData.remaining} meetings
                             </span>
                           </div>
                         )}
                         <div className="pt-3 border-t border-border">
                           <p className="text-sm text-muted-foreground">
                             Upgrade to Pro for unlimited meetings and advanced features.
                           </p>
                         </div>
                       </div>
                     )}
            </div>

            {/* Features comparison */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Plan Features</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-4 h-4 rounded-full",
                    hasActiveSubscription ? "bg-green-500" : "bg-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">
                    {hasActiveSubscription ? "Unlimited meetings" : "10 meetings per month"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-4 h-4 rounded-full",
                    hasActiveSubscription ? "bg-green-500" : "bg-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">
                    {hasActiveSubscription ? "Advanced AI features" : "Basic AI summaries"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-4 h-4 rounded-full",
                    hasActiveSubscription ? "bg-green-500" : "bg-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">
                    {hasActiveSubscription ? "Priority support" : "Community support"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {hasActiveSubscription ? (
                <>
                  <Button 
                    onClick={handleManageBilling} 
                    className="w-full"
                    disabled={loading}
                  >
                    Manage Billing
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Update payment method, download invoices, or cancel subscription
                  </p>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleUpgradeToPro} 
                    className="w-full"
                    disabled={upgradeLoading}
                  >
                    {upgradeLoading ? 'Creating checkout...' : 'Upgrade to Pro'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Get unlimited meetings and advanced features
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 