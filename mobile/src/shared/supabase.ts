import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConfigUnvalidated } from './config';

const config = getConfigUnvalidated();

if (!config.SUPABASE_URL) {
  console.warn('DopaQueue Mobile: SUPABASE_URL is not configured.');
  config.SUPABASE_URL = 'https://dummy-project.supabase.co';
}

if (!config.SUPABASE_ANON_KEY) {
  console.warn('DopaQueue Mobile: SUPABASE_ANON_KEY is not configured.');
  config.SUPABASE_ANON_KEY = 'dummy-key';
}

// Create Supabase client with AsyncStorage
const supabaseClient: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabaseClient, config };
export default supabaseClient;
