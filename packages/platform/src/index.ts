export { AppQueryProvider } from '../../shared/providers/QueryProvider';
export { bootstrapReactApp } from './bootstrapReactApp';
export type { BootstrapReactAppOptions } from './bootstrapReactApp';
export { safeStorage } from '../../shared/safeStorage';
export { logger, getErrorMessage, handleError, installGlobalErrorHandlers } from '../../shared/services/logger';
export { supabase, isSupabaseEnabled } from '../../shared/services/supabaseClient';
export { useAuthStore } from '../../shared/stores/useAuthStore';
export { useThemeStore } from '../../shared/stores/useThemeStore';
export { useToast } from '../../shared/stores/useToast';
