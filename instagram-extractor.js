const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = 3005;

// Enable CORS and Debug Logging
app.use((req, res, next) => {
  console.log(`[Incoming] ${req.method} ${req.url}`);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Parse JSON bodies for ALL routes (must be before route handlers)
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.send('OK'));

// ─── PRIMARY ENDPOINT: Proxy any CDN image URL ──────────────────────────────
// Usage: /proxy/image?url=<encoded-cdn-url>
// Bypasses CORS and Referer restrictions for Instagram/Facebook CDN images
app.get('/proxy/image', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  console.log(`[Proxy] Fetching CDN image: ${url.substring(0, 80)}...`);

  try {
    const imageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!imageResponse.ok) {
      console.error(`[Proxy] CDN fetch failed: ${imageResponse.status}`);
      return res.redirect(`https://images.placeholders.dev/?width=640&height=360&text=Image+Unavailable&bgColor=%230a0a0a&textColor=%23666666`);
    }

    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });

    imageResponse.body.pipe(res);
  } catch (error) {
    console.error('[Proxy] Error fetching image:', error.message);
    res.redirect(`https://images.placeholders.dev/?width=640&height=360&text=Proxy+Error&bgColor=%230a0a0a&textColor=%23666666`);
  }
});

// ─── WEBHOOK PROXY: Bypass CORS for n8n ────────────────────────────────────
// Usage: POST /proxy/webhook?target=<n8n-webhook-url>
app.post('/proxy/webhook', async (req, res) => {
  const { target } = req.query;

  if (!target) {
    return res.status(400).json({ error: 'target parameter required' });
  }

  console.log(`[Proxy] Forwarding webhook request to: ${target}`);

  // n8n runs as a sibling Docker container named 'n8n'.
  // Remap localhost/127.0.0.1 URLs to the Docker service name.
  const resolvedTarget = target
    .replace('http://localhost:', 'http://n8n:')
    .replace('http://127.0.0.1:', 'http://n8n:');

  console.log(`[Proxy] Resolved target: ${resolvedTarget}`);

  try {
    const response = await fetch(resolvedTarget, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      jsonData = { message: data };
    }

    res.status(response.status).json(jsonData);
  } catch (error) {
    console.error('[Proxy] Webhook fetch error:', error.message);
    res.status(500).json({ error: 'Failed to trigger webhook', details: error.message });
  }
});

// ─── COMPAT ENDPOINT: /thumbnail/instagram ───────────────────────────────────
// Accepts ?thumbnail=<cdn-url> to proxy a stored CDN URL
// Accepts ?url=<instagram-video-url> as fallback (serves a placeholder)
app.get('/thumbnail/instagram', async (req, res) => {
  const { url, thumbnail } = req.query;

  // If a direct CDN thumbnail URL is provided, proxy it
  if (thumbnail) {
    return res.redirect(`/proxy/image?url=${encodeURIComponent(thumbnail)}`);
  }

  // If only a video url provided, extract shortcode for a themed placeholder
  const shortcode = url?.match(/(?:instagram\.com\/(?:p|reel|reels)\/)([^/?#&]+)/)?.[1];
  if (!shortcode) {
    return res.status(400).json({ error: 'Invalid Instagram URL - provide thumbnail= or url=' });
  }

  console.log(`[Extractor] No CDN URL for ${shortcode}, serving placeholder`);
  res.redirect(`https://images.placeholders.dev/?width=640&height=360&text=Instagram+Reel&bgColor=%231a1a2e&textColor=%23ffffff`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Instagram thumbnail proxy running on port ${PORT}`);
});
