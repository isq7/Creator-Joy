import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key) => {
        // Try retrieving single cookie first (legacy/small)
        const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
        if (match) return decodeURIComponent(match[2]);

        // Try retrieving chunked cookies (Reconstruct session)
        let value = '';
        let i = 0;
        while (true) {
          const chunkKey = `${key}.${i}`;
          const chunkMatch = document.cookie.match(new RegExp('(^| )' + chunkKey + '=([^;]+)'));
          if (!chunkMatch) break;
          value += decodeURIComponent(chunkMatch[2]);
          i++;
        }
        return value || null;
      },
      setItem: (key, value) => {
        // 1. Determine environment (IP vs Domain)
        const isIp = /^[0-9]+(\.[0-9]+){3}$/.test(window.location.hostname);
        const domainAttribute = isIp ? '' : `; domain=.${window.location.hostname}`;
        const expires = '; max-age=31536000; SameSite=Lax';

        // 2. Clear any existing single cookie to prevent conflicts
        document.cookie = `${key}=; path=/${domainAttribute}; max-age=0; SameSite=Lax`;

        // 3. Chunking logic (Limit 3000 chars per chunk to be safe)
        const chunkSize = 3000;
        const numChunks = Math.ceil(value.length / chunkSize);

        for (let i = 0; i < numChunks; i++) {
          const chunk = value.substring(i * chunkSize, (i + 1) * chunkSize);
          document.cookie = `${key}.${i}=${encodeURIComponent(chunk)}; path=/${domainAttribute}${expires}`;
        }
      },
      removeItem: (key) => {
        const isIp = /^[0-9]+(\.[0-9]+){3}$/.test(window.location.hostname);
        const domainAttribute = isIp ? '' : `; domain=.${window.location.hostname}`;
        const options = `; path=/${domainAttribute}; max-age=0; SameSite=Lax`;

        // Remove single cookie
        document.cookie = `${key}=${options}`;

        // Remove chunks (check up to 20 chunks to be safe)
        for (let i = 0; i < 20; i++) {
          document.cookie = `${key}.${i}=${options}`;
        }
      },
    },
    flowType: 'implicit', // Match Air Creator flow
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Client for administrative tasks (bypassing RLS)
export const supabaseService = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
