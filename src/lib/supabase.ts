import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isBrowser = typeof window !== 'undefined';

const supabaseUrl = isBrowser
    ? import.meta.env.VITE_SUPABASE_URL
    : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

const supabaseKey = isBrowser
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    _supabase = createClient(supabaseUrl, supabaseKey);
    return _supabase;
}

export const supabase = (() => {
    if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase credentials not found. Database operations will fail.');
        return null as unknown as SupabaseClient;
    }
    return createClient(supabaseUrl, supabaseKey);
})();

export const isSupabaseAvailable = () => !!supabaseUrl && !!supabaseKey;
