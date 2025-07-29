'use client';

import React from 'react';
import { X, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IntegrationsModalProps {
  onClose: () => void;
}

export function IntegrationsModal({ onClose }: IntegrationsModalProps) {
  const integrations = [
    {
      id: 'calendar',
      name: 'Calendar',
      description: 'Sync your meetings with Google Calendar or Outlook',
      icon: Calendar,
      status: 'coming-soon',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get meeting summaries and notifications in Slack',
      icon: MessageSquare,
      status: 'coming-soon',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Integrations</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your favorite tools to enhance your meeting experience.
          </p>

          <div className="space-y-4">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <div
                  key={integration.id}
                  className="border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        integration.bgColor
                      )}>
                        <Icon size={20} className={integration.color} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-foreground mb-1">
                          {integration.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {integration.description}
                        </p>
                      </div>
                    </div>
                    <div>
                      {integration.status === 'coming-soon' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
                      ) : (
                        <Button size="sm" variant="outline">
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              More integrations coming soon! Have a request? 
              <a 
                href="mailto:support@tryohm.com?subject=Integration Request" 
                className="text-foreground hover:underline ml-1"
              >
                Let us know
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 