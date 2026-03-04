# Instructions for Air Ideas (Port 3002) - Shared Cookie SSO

> **🚀 How to use:** You can copy this entire file and paste it to your AI Assistant (Gemini/Cursor/Windsurf) with the prompt: *"Please apply this Supabase configuration to my project."*

**Objective:** Enable users logged into "Air Creator" (Port 3001) to be automatically logged into "Air Ideas" (Port 3002) without needing to re-authenticate or pass tokens in the URL.

**Mechanism:** We are now saving the Supabase Session in a **cookie** instead of `localStorage`. Because both apps run on the same Host (IP `93.127.216.83` or domain `aircreator.cloud`), this cookie is shared automatically across ports.

---

## ⚠️ Critical Requirements
1.  **Same Project:** Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` **must match exacty** with the ones used in Air Creator (Port 3001).
2.  **Same Config:** You must use the **exact** `createClient` configuration below. If the cookie logic matches, the session will be found.

---

## Step 1: Update Your Supabase Client

Replace your `createClient` initialization with this code. This adds a custom storage adapter that handles both IP addresses and Domains correctly.

```typescript
import { createClient } from '@supabase/supabase-js';

// MUST MATCH AIR CREATOR'S CREDENTIALS
export const SUPABASE_URL = 'https://pezvnqhexxttlhcnbtta.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlenZucWhleHh0dGxoY25idHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3ODQwNjYsImV4cCI6MjA3NDM2MDA2Nn0.b5cWpEYD6s5gRYg5jcBNyjE-kL_IGAVqtMfXk8wB6zU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => {
        const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      },
      setItem: (key, value) => {
        // 1. Determine if we are on an IP or a Domain
        // Regex checks for IPv4 pattern
        const isIp = /^[0-9]+(\.[0-9]+){3}$/.test(window.location.hostname);
        
        // 2. Build the domain string
        // If it's a domain (aircreator.cloud), add the dot prefix for wildcards.
        // If it's an IP, leave it empty (browser ignores domain attr for IPs, defaults to host-only).
        const domainAttribute = isIp ? '' : `; domain=.${window.location.hostname}`;
        
        // 3. Set the cookie
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/${domainAttribute}; max-age=31536000; SameSite=Lax`;
      },
      removeItem: (key) => {
        const isIp = /^[0-9]+(\.[0-9]+){3}$/.test(window.location.hostname);
        const domainAttribute = isIp ? '' : `; domain=.${window.location.hostname}`;
        document.cookie = `${key}=; path=/${domainAttribute}; max-age=0; SameSite=Lax`;
      },
    },
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

---

## Step 2: Verification
1.  Open `http://aircreator.cloud:3001` (Air Creator) and log in.
2.  Open `http://aircreator.cloud:3002` (Air Ideas).
3.  **Result:** You should be automatically logged in properly.
