'use client';

import React from 'react';
import { X, Camera, Mic, Monitor, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissionType: 'camera' | 'microphone' | 'screen' | 'audio';
  error?: string;
}

export function PermissionModal({ isOpen, onClose, permissionType, error }: PermissionModalProps) {
  if (!isOpen) return null;

  const getPermissionInfo = () => {
    switch (permissionType) {
      case 'camera':
        return {
          icon: <Camera size={48} className="text-blue-500" />,
          title: 'Camera Permission Required',
          description: 'To use your camera in this meeting, you need to allow camera access in your browser.',
          steps: [
                         'Click the camera icon in your browser&apos;s address bar',
            'Select "Allow" for camera access',
            'Refresh the page if needed',
            'Try turning on your camera again'
          ]
        };
      case 'microphone':
        return {
          icon: <Mic size={48} className="text-green-500" />,
          title: 'Microphone Permission Required',
          description: 'To use your microphone in this meeting, you need to allow microphone access in your browser.',
          steps: [
            'Click the microphone icon in your browser&apos;s address bar',
            'Select "Allow" for microphone access',
            'Refresh the page if needed',
            'Try turning on your microphone again'
          ]
        };
      case 'screen':
        return {
          icon: <Monitor size={48} className="text-purple-500" />,
          title: 'Screen Sharing Permission Required',
          description: 'To share your screen, you need to grant screen sharing permission.',
          steps: [
            'Click "Share" when the browser asks for screen sharing permission',
            'Select the screen or window you want to share',
            'Click "Share" to confirm',
            'Try screen sharing again'
          ]
        };
      case 'audio':
        return {
          icon: <Mic size={48} className="text-orange-500" />,
          title: 'Audio Permission Required',
          description: 'To use audio features, you need to allow microphone access in your browser.',
          steps: [
            'Click the microphone icon in your browser&apos;s address bar',
            'Select "Allow" for microphone access',
            'Refresh the page if needed',
            'Try again'
          ]
        };
      default:
        return {
          icon: <AlertCircle size={48} className="text-red-500" />,
          title: 'Permission Required',
          description: 'This feature requires browser permission to work.',
          steps: ['Please check your browser settings and try again']
        };
    }
  };

  const permissionInfo = getPermissionInfo();

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) {
      return {
        browser: 'Chrome',
        instructions: [
          'Look for the camera/microphone icon in the address bar (left side)',
          'Click on it and select "Always allow"',
          'Or go to Settings → Privacy and security → Site Settings → Camera/Microphone',
          'Find this site and change permission to "Allow"'
        ]
      };
    } else if (userAgent.includes('Firefox')) {
      return {
        browser: 'Firefox',
        instructions: [
          'Look for the shield icon in the address bar',
          'Click on it and select "Allow" for camera/microphone',
          'Or go to Settings → Privacy & Security → Permissions',
          'Find Camera/Microphone and manage permissions for this site'
        ]
      };
    } else if (userAgent.includes('Safari')) {
      return {
        browser: 'Safari',
        instructions: [
          'Go to Safari → Settings → Websites',
          'Select Camera or Microphone from the left sidebar',
          'Find this website and change permission to "Allow"',
          'Refresh the page after changing permissions'
        ]
      };
    } else if (userAgent.includes('Edge')) {
      return {
        browser: 'Edge',
        instructions: [
          'Look for the camera/microphone icon in the address bar',
          'Click on it and select "Always allow"',
          'Or go to Settings → Cookies and site permissions → Camera/Microphone',
          'Find this site and change permission to "Allow"'
        ]
      };
    }
    
    return {
      browser: 'Your Browser',
      instructions: [
        'Look for permission icons in your browser&apos;s address bar',
        'Click on them and select "Allow"',
        'Check your browser&apos;s privacy/security settings',
        'Look for camera/microphone permissions and allow them for this site'
      ]
    };
  };

  const browserInfo = getBrowserInstructions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#1a1a1a] border border-[rgba(55,65,81,0.3)] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(55,65,81,0.3)]">
          <div className="flex items-center gap-3">
            {permissionInfo.icon}
            <h2 className="text-lg font-semibold text-white">{permissionInfo.title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-300 leading-relaxed">
            {permissionInfo.description}
          </p>

          {/* Error message if provided */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-red-400 text-sm font-medium">Error Details:</span>
              </div>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Quick Steps */}
          <div>
            <h3 className="text-white font-medium mb-3">Quick Steps:</h3>
            <ol className="space-y-2">
              {permissionInfo.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-300 text-sm">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Browser-specific instructions */}
          <div>
            <h3 className="text-white font-medium mb-3">{browserInfo.browser} Instructions:</h3>
            <ul className="space-y-2">
              {browserInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></span>
                  <span className="text-gray-300 text-sm">{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Additional help */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-blue-400 font-medium mb-2">💡 Still having trouble?</h4>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• Try refreshing the page after changing permissions</li>
              <li>• Make sure no other applications are using your camera/microphone</li>
              <li>• Check if your browser is up to date</li>
              <li>• Try using an incognito/private window</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[rgba(55,65,81,0.3)]">
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              I&apos;ve Updated Permissions
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex-1 border-[rgba(55,65,81,0.3)] text-gray-300 hover:text-white hover:bg-white/10"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 