import { createClient } from '@supabase/supabase-js';

// Support both browser (import.meta.env) and Node.js (process.env)
const isBrowser = typeof window !== 'undefined';

// Get URL - try multiple env var names
const supabaseUrl = isBrowser
    ? import.meta.env.VITE_SUPABASE_URL
    : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

// Get key - try multiple env var names, prefer service role for backend
const supabaseKey = isBrowser
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found. Running in offline mode.');
}

// Singleton Supabase client
export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : createClient('https://placeholder.supabase.co', 'placeholder'); // Fallback to prevent crashes


// Helper to check if Supabase is available
export const isSupabaseAvailable = () => !!supabaseUrl && !!supabaseKey;

