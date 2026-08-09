const DEFAULT_CONFIG = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  ENVIRONMENT: __DEV__ ? 'development' : 'production',
};

export function getConfigUnvalidated() {
  return DEFAULT_CONFIG;
}

export function getValidatedConfig() {
  const config = getConfigUnvalidated();
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.warn('[DopaQueue Mobile] SUPABASE_URL or SUPABASE_ANON_KEY not configured.');
  }
  return config;
}

const config = getValidatedConfig();
export default config;
