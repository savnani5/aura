/**
 * Utility functions for handling media device permissions
 */

export type PermissionType = 'camera' | 'microphone' | 'screen' | 'audio';

export interface PermissionError {
  type: PermissionType;
  message: string;
  isPermissionDenied: boolean;
  originalError: Error | unknown;
}

/**
 * Check if an error is a permission-related error
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError' ||
      error.message.includes('Permission denied') ||
      error.message.includes('permission denied') ||
      error.message.includes('User denied') ||
      error.message.includes('user denied') ||
      error.message.includes('NotAllowedError')
    );
  }
  
  if (typeof error === 'string') {
    return (
      error.includes('Permission denied') ||
      error.includes('permission denied') ||
      error.includes('User denied') ||
      error.includes('user denied') ||
      error.includes('NotAllowedError')
    );
  }
  
  return false;
}

/**
 * Parse an error to determine the permission type and create a standardized error object
 */
export function parsePermissionError(
  error: unknown, 
  context: 'camera' | 'microphone' | 'screen' | 'audio'
): PermissionError {
  let message = 'Permission denied';
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  
  return {
    type: context,
    message,
    isPermissionDenied: isPermissionError(error),
    originalError: error
  };
}

/**
 * Check if the browser supports the required media API
 */
export function checkMediaSupport(): {
  hasGetUserMedia: boolean;
  hasGetDisplayMedia: boolean;
  supportedConstraints: MediaTrackSupportedConstraints | null;
} {
  const hasGetUserMedia = !!(
    navigator.mediaDevices && 
    navigator.mediaDevices.getUserMedia
  );
  
  const hasGetDisplayMedia = !!(
    navigator.mediaDevices && 
    navigator.mediaDevices.getDisplayMedia
  );
  
  let supportedConstraints: MediaTrackSupportedConstraints | null = null;
  
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints) {
      supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
    }
  } catch (e) {
    console.warn('Could not get supported constraints:', e);
  }
  
  return {
    hasGetUserMedia,
    hasGetDisplayMedia,
    supportedConstraints
  };
}

/**
 * Get user-friendly error messages for different permission scenarios
 */
export function getPermissionErrorMessage(
  permissionType: PermissionType,
  error?: unknown
): string {
  const baseMessages = {
    camera: 'Camera access is required to use your camera in this meeting.',
    microphone: 'Microphone access is required to use your microphone in this meeting.',
    screen: 'Screen sharing permission is required to share your screen.',
    audio: 'Audio access is required for this feature.'
  };
  
  let specificMessage = '';
  
  if (error instanceof Error) {
    if (error.name === 'NotSupportedError') {
      specificMessage = ` This feature is not supported in your current browser.`;
    } else if (error.name === 'NotReadableError') {
      specificMessage = ` Your ${permissionType} might be in use by another application.`;
    } else if (error.name === 'OverconstrainedError') {
      specificMessage = ` The requested ${permissionType} settings are not available.`;
    }
  }
  
  return baseMessages[permissionType] + specificMessage;
}

/**
 * Attempt to request permission for a specific media device
 */
export async function requestMediaPermission(
  type: 'camera' | 'microphone' | 'audio',
  deviceId?: string
): Promise<{ success: boolean; stream?: MediaStream; error?: PermissionError }> {
  try {
    const constraints: MediaStreamConstraints = {};
    
    if (type === 'camera') {
      constraints.video = deviceId ? { deviceId } : true;
    } else if (type === 'microphone' || type === 'audio') {
      constraints.audio = deviceId ? { deviceId } : true;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    return { success: true, stream };
  } catch (error) {
    const permissionError = parsePermissionError(error, type);
    return { success: false, error: permissionError };
  }
}

/**
 * Request screen sharing permission
 */
export async function requestScreenSharePermission(): Promise<{
  success: boolean;
  stream?: MediaStream;
  error?: PermissionError;
}> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser');
    }
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    
    return { success: true, stream };
  } catch (error) {
    const permissionError = parsePermissionError(error, 'screen');
    return { success: false, error: permissionError };
  }
}

/**
 * Check current permission status for media devices
 */
export async function checkPermissionStatus(
  type: 'camera' | 'microphone'
): Promise<PermissionState | null> {
  try {
    if (!navigator.permissions) {
      return null;
    }
    
    const permissionName = type === 'camera' ? 'camera' : 'microphone';
    const result = await navigator.permissions.query({ name: permissionName as PermissionName });
    
    return result.state;
  } catch (error) {
    console.warn('Could not check permission status:', error);
    return null;
  }
} 