'use client';

import React from 'react';
import { X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HelpSupportModalProps {
  onClose: () => void;
}

export function HelpSupportModal({ onClose }: HelpSupportModalProps) {
  const handleEmailClick = () => {
    window.location.href = 'mailto:support@auranow.co';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-primary" />
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              For all support inquiries, including billing issues, receipts, and general assistance, please email
            </p>
            
            <Button 
              onClick={handleEmailClick}
              className="w-full max-w-xs mx-auto"
            >
              support@auranow.co
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 