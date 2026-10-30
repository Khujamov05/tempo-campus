import { createClient } from '@supabase/supabase-js';

// Only the public publishable key belongs in a frontend build.
// Never use a secret/service_role key here.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wsyaztmkqvysfsmwehan.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_e_2rUitEp1s9_Le1hfjqJQ_7IQiMHMQ';
export const supabase = url && key ? createClient(url, key) : null;
