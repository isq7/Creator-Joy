import { useEffect, useRef, useState } from 'react';

const InstagramEmbed = ({ url, className }) => {
  const containerRef = useRef(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const extractThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);

        // Use our centralized proxy service
        const proxyUrl = `/thumbnail/instagram?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (response.ok) {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setThumbnailUrl(imageUrl);
        } else {
          throw new Error('Failed to extract thumbnail');
        }
      } catch (err) {
        console.error('Instagram thumbnail extraction failed:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      extractThumbnail();
    }

    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className={className} style={{
        width: '100%',
        height: '200px',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        position: 'relative'
      }}>
        <div style={{
          color: '#666',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Loading Instagram...
        </div>
      </div>
    );
  }

  if (error || !thumbnailUrl) {
    // Extract shortcode for fallback
    const shortcode = url.match(/(?:instagram\.com\/(?:p|reel)\/)([^/?#&]+)/)?.[1];
    return (
      <div className={className} style={{
        width: '100%',
        height: '200px',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        position: 'relative'
      }}>
        <img
          src={`https://picsum.photos/seed/ig-${shortcode}/640/360.jpg`}
          alt="Instagram video"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px'
          }}
        />
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          Instagram
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{
      width: '100%',
      height: '200px',
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <img
        src={thumbnailUrl}
        alt="Instagram video thumbnail"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '8px'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        Instagram
      </div>
    </div>
  );
};

export default InstagramEmbed;
