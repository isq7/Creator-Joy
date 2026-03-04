import { useEffect, useState } from 'react';
import { Eye, Play } from 'lucide-react';
import './VideoModal.css';

function VideoModal({ video, onClose }) {
    // Show a visual play button — pointer-events:none so clicks pass through to the iframe
    // window 'blur' fires the moment user clicks inside the iframe (iframe steals focus)
    const [showPlayBtn, setShowPlayBtn] = useState(true);

    // Hide play button once user interacts with iframe
    useEffect(() => {
        const handleBlur = () => setShowPlayBtn(false);
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);



    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const isInstagram = video.video_url?.includes('instagram.com');
    const isYouTubeShorts = video.video_url?.includes('shorts/');

    const getMultiplierColorClass = (multiplier) => {
        if (multiplier >= 7) return 'multiplier-high';
        if (multiplier >= 3) return 'multiplier-medium';
        return 'multiplier-low';
    };

    /**
     * Get tiered emoji data based on multiplier value
     * @param {number} multiplier 
     * @returns {string} emoji
     */
    const getEmoji = (multiplier) => {
        if (multiplier >= 25) return '💥';
        if (multiplier >= 15) return '🧨';
        if (multiplier >= 10) return '💎';
        if (multiplier >= 5) return '🚀';
        if (multiplier >= 2) return '🔥';
        return null;
    };

    const emoji = getEmoji(video.multiplier);

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            {isInstagram ? (
                /* --- INSTAGRAM CARD LAYOUT --- */
                <div className="ig-card">
                    <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
                    <div className="ig-frame-wrap">
                        {/* iframe always loads in background immediately */}
                        <iframe
                            src={video.embed_url}
                            className="ig-iframe"
                            allow="autoplay; encrypted-media"
                            scrolling="no"
                            title={video.title || 'Instagram Reel'}
                        />
                        <div className="ig-bottom-mask"></div>

                        {/* Play button — pointer-events:none lets clicks pass straight to iframe.
                            window blur fires when iframe takes focus (user clicked it) → button hides. */}
                        {showPlayBtn && (
                            <div className="ig-play-overlay">
                                <div className="ig-play-btn">
                                    <Play fill="currentColor" size={28} />
                                </div>
                            </div>
                        )}

                        {/* Multiplier badge */}
                        <div className="ig-meta-top">
                            <div className={`ig-multiplier-badge ${getMultiplierColorClass(video.multiplier)}`}>
                                {emoji && <span className="badge-emoji">{emoji}</span>}{video.multiplier}x
                            </div>
                        </div>
                    </div>

                    <div className="ig-meta-bottom-group">
                        <div className="ig-video-title-bottom">{video.title}</div>
                        <div className="ig-metadata-grid">
                            <div className="ig-meta-col">
                                <span className="ig-meta-label">VIEWS</span>
                                <span className="ig-meta-value">
                                    {video.views >= 1000000
                                        ? `${(video.views / 1000000).toFixed(1)}M`
                                        : `${(video.views / 1000).toFixed(0)}K`}
                                </span>
                            </div>
                            <div className="ig-meta-col">
                                <span className="ig-meta-label">PUBLISHED</span>
                                <span className="ig-meta-value">
                                    {new Date(video.date_posted).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                            <div className="ig-meta-col ig-meta-col-creator">
                                <span className="ig-meta-label">CREATOR</span>
                                <span className="ig-meta-value creator-handle" title={`@${video.creator}`}>
                                    @{video.creator}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* --- STANDARD LAYOUT (YouTube): keep preview + play button --- */
                <div className="modal-content vertical-video">
                    <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
                    <div className="video-container">
                        {isPlaying ? (
                            <iframe
                                src={video.embed_url + (video.embed_url.includes('?') ? '&' : '?') + 'autoplay=1'}
                                title={video.title || 'Embedded video'}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="video-preview-overlay" onClick={() => setIsPlaying(true)}>
                                <img
                                    src={video.thumbnail}
                                    className="modal-preview-thumb"
                                    alt={video.title}
                                />
                                <div className="proper-play-btn-wrapper">
                                    <div className="proper-play-btn">
                                        <Play fill="currentColor" size={32} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="standard-modal-info">
                        <h3>{video.title}</h3>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VideoModal;
