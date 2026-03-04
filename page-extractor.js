const express = require('express');
const { JSDOM } = require('jsdom');
const app = express();
const PORT = 3002;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Extract thumbnail from Instagram page HTML
app.get('/thumbnail/instagram-page', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    // Fetch the Instagram page (not the embed)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML to find the thumbnail
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Look for the thumbnail in multiple places
    let thumbnailUrl = null;
    
    // Method 1: Look for JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.image && data.image.url) {
          thumbnailUrl = data.image.url;
          break;
        }
        if (data.thumbnailUrl) {
          thumbnailUrl = data.thumbnailUrl;
          break;
        }
      } catch (e) {
        // Continue if JSON parsing fails
      }
    }
    
    // Method 2: Look for meta tags
    if (!thumbnailUrl) {
      const metaImage = document.querySelector('meta[property="og:image"]');
      if (metaImage && metaImage.content) {
        thumbnailUrl = metaImage.content;
      }
    }
    
    // Method 3: Look for video thumbnail in page data
    if (!thumbnailUrl) {
      const videoThumbnail = document.querySelector('meta[property="og:video"]');
      if (videoThumbnail && videoThumbnail.content) {
        // Extract thumbnail from video URL if possible
        thumbnailUrl = videoThumbnail.content;
      }
    }
    
    // Method 4: Look for any image in the main content
    if (!thumbnailUrl) {
      const mainImage = document.querySelector('img[src*="cdninstagram.com"], img[src*="fbcdn.net"]');
      if (mainImage && mainImage.src) {
        thumbnailUrl = mainImage.src;
      }
    }

    if (!thumbnailUrl) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    // Fetch the actual thumbnail image and serve it
    const imageResponse = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/'
      }
    });

    if (!imageResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch thumbnail image' });
    }

    // Set appropriate headers and serve the image
    res.set({
      'Content-Type': imageResponse.headers.get('Content-Type'),
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    });

    imageResponse.body.pipe(res);

  } catch (error) {
    console.error('Thumbnail extraction error:', error);
    res.status(500).json({ error: 'Failed to extract thumbnail' });
  }
});

app.listen(PORT, () => {
  console.log(`Instagram page thumbnail extractor running on port ${PORT}`);
});
