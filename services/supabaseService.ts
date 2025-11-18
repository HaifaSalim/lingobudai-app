import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Your Supabase credentials should be set in Vercel Environment Variables
// and in a .env.local file for local development.
// Example .env.local:
// VITE_SUPABASE_URL=https://your-project-url.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is not set. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);