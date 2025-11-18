
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Your Supabase credentials should be set in a .env.local file.
// Example:
// VITE_SUPABASE_URL=https://your-project-url.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is not set. Please create a .env.local file and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
