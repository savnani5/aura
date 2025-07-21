// Utilities - Centralized exports for all utility functions
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export * from './client-utils';
export { useSetupE2EE } from './e2ee-setup'; 