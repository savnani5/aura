// Export all stores and their types
export * from './meeting-store'
export * from './workspace-store'  
export * from './ui-store'

// Export store instances for easier access
export { useMeetingStore, useMeetingSelectors } from './meeting-store'
export { useWorkspaceStore, useWorkspaceSelectors, useWorkspaceActions } from './workspace-store'
export { useUIStore, useUISelectors, useUIActions } from './ui-store'

// Store types are exported from individual store files
// Use the individual store hooks and selectors for type-safe access 