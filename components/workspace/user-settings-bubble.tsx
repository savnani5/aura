'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, UserButton } from '@clerk/nextjs';
import { User, CreditCard, LogOut, HelpCircle, Puzzle } from 'lucide-react';

interface UserSettingsBubbleProps {
  user: any;
  onClose: () => void;
  onOpenBilling?: () => void;
  onOpenIntegrations?: () => void;
  onOpenHelp?: () => void;
}

export function UserSettingsBubble({ 
  user, 
  onClose, 
  onOpenBilling,
  onOpenIntegrations,
  onOpenHelp 
}: UserSettingsBubbleProps) {
  const router = useRouter();
  const { signOut, openUserProfile } = useClerk();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleProfile = () => {
    openUserProfile();
    onClose();
  };

  const handleBilling = () => {
    if (onOpenBilling) {
      onOpenBilling();
    }
    onClose();
  };

  const handleHelpSupport = () => {
    if (onOpenHelp) {
      onOpenHelp();
    }
    onClose();
  };

  const handleIntegrations = () => {
    if (onOpenIntegrations) {
      onOpenIntegrations();
    }
    onClose();
  };

  // Get user avatar URL if available
  const userAvatar = user?.imageUrl;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div 
        className="absolute bottom-20 left-6 bg-card rounded-xl shadow-xl border border-border py-2 min-w-[200px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User Info */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center space-x-3">
            {userAvatar ? (
              <img 
                src={userAvatar} 
                alt={user.fullName || 'User'} 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
              {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
            </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.fullName || user.firstName || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <button
            onClick={handleProfile}
            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <User size={16} />
            <span>Profile</span>
          </button>

          <button
            onClick={handleBilling}
            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <CreditCard size={16} />
            <span>Billing</span>
          </button>

          <button
            onClick={handleIntegrations}
            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Puzzle size={16} />
            <span>Integrations</span>
          </button>

          <button
            onClick={handleHelpSupport}
            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <HelpCircle size={16} />
            <span>Help & Support</span>
          </button>
        </div>

        {/* Sign Out */}
        <div className="border-t border-border py-1">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
} 