# Instructions for Air Ideas (Port 3002) - Shared Cookie SSO

> **🚀 How to use:** You can copy this entire file and paste it to your AI Assistant (Gemini/Cursor/Windsurf) with the prompt: *"Please apply this Supabase configuration to my project."*

**Objective:** Enable users logged into "Air Creator" (Port 3001) to be automatically logged into "Air Ideas" (Port 3002) without needing to re-authenticate.

**Mechanism:** We are using **Chunked Shared Cookies**. The session is split into multiple cookies (`sb-...-auth-token.0`, `.1`) to bypass 4KB browser limits.

---

## ⚠️ Critical Requirements
1.  **Same Project:** Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` **must match exactly**.
2.  **Same Config:** You **MUST** use the custom storage adapter below. It contains the logic to read the chunked cookies. Without this, auth will fail.

---

## Step 1: Update Your Supabase Client

Replace your `createClient` initialization with this code.

```typescript
import { createClient } from '@supabase/supabase-js';

// MUST MATCH AIR CREATOR'S CREDENTIALS
export const SUPABASE_URL = 'https://pezvnqhexxttlhcnbtta.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlenZucWhleHh0dGxoY25idHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3ODQwNjYsImV4cCI6MjA3NDM2MDA2Nn0.b5cWpEYD6s5gRYg5jcBNyjE-kL_IGAVqtMfXk8wB6zU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    flowType: 'implicit', // IMPORTANT: Changed from pkce to implicit
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

---

## Step 2: Consuming User Metadata

To improve performance, we now **sanitize** the user metadata.
You will only find these specific fields in `session.user.user_metadata`. Do not rely on others.

| Field | Example | Description |
|-------|---------|-------------|
| `full_name` | "Aditya Gaikwad" | Use this. `name` and `nickname` are removed. |
| `avatar_url`| "https://..." | Profile picture. |
| `email` | "user@example.com"| User Email. |
| `provider` | "facebook" | The login provider. |
| `facebook_id` | "12345..." | ID if logged in via FB/IG Graph. |
| `instagram_id`| "178..." | ID if logged in via IG. |

**Example Usage:**

```typescript
const { data: { user } } = await supabase.auth.getUser();

// ✅ GOOD
console.log(user.user_metadata.full_name);

// ❌ BAD (These are removed)
console.log(user.user_metadata.name); 
console.log(user.user_metadata.picture);
console.log(user.user_metadata.iss);
```
