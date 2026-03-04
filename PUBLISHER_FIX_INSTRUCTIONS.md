# FIX: Shared Auth & Crash Prevention for Air Publisher

## Problem
The `/ideas` app (Creator Joy) stores its session as a base64-encoded, chunked cookie. When the user redirects to `/publisher`, the standard Supabase client in the Publisher app attempts to parse this cookie, fails because it expects JSON, and throws a fatal `TypeError: Cannot create property 'user' on string`.

## Solution for Antigravity (Publisher Side)
**Please implement the following logic in the Publisher app to ensure shared login works and crashes are prevented:**

### 1. Update the Middleware
The middleware must act as the "cleaner." If it detects a `unique_identifier` in the URL, it must prioritize that and clear any conflicting Supabase cookies left by the Ideas app.

```javascript
// middleware.ts (or equivalent) logic
const url = new URL(request.url)
const uniqueIdentifier = url.searchParams.get('unique_identifier')

if (uniqueIdentifier) {
  // 1. Create the response object
  const response = NextResponse.next()
  
  // 2. CLEAR the problematic Supabase cookie
  // This prevents the Supabase client from crashing on the Ideas app's base64 data
  response.cookies.set('sb-auth-token', '', { maxAge: 0 })
  // Also clear chunks just in case
  for (let i = 0; i < 10; i++) {
    response.cookies.set(`sb-auth-token.${i}`, '', { maxAge: 0 })
  }

  // 3. SET the new master identifier for the Publisher app
  response.cookies.set('creator_unique_identifier', uniqueIdentifier, {
    path: '/',
    httpOnly: false, // Accessible by client-side if needed
    maxAge: 60 * 60 * 24 * 365 // 1 year
  })

  return response
}
```

### 2. Safeguard Supabase Initialization
Wrap the Supabase client initialization (or the first `getSession()` call) in a `try/catch` block to handle any remaining "poisoned" data gracefully.

```javascript
// supabaseClient.js or Auth Provider
try {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
} catch (error) {
  // If the Ideas app data still causes a crash
  if (error.message?.includes('Cannot create property') || error.message?.includes('base64')) {
    console.warn('Corrupted session data detected, clearing...')
    // Wipe local storage keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        localStorage.removeItem(key)
      }
    })
    window.location.reload()
  }
}
```

## Expected Result
1. User clicks from Ideas -> Publisher with `?unique_identifier=xxx`.
2. Middleware sees the ID, **deletes the "broken" Ideas cookies**, and sets the `creator_unique_identifier`.
3. The Publisher app loads cleanly without crashing.
4. The Publisher uses the `creator_unique_identifier` cookie to establish its own fresh persistent session.
