import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import './VideoModal.css';

function VideoModal({ video, onClose }) {
    // For Instagram: visual play button (pointer-events:none, click passes to iframe)
    const [showPlayBtn, setShowPlayBtn] = useState(true);
    // For YouTube: tracks whether iframe has been loaded
    const [isPlaying, setIsPlaying] = useState(false);

    // Hide IG play button once user clicks into iframe (window loses focus)
    useEffect(() => {
        const handleBlur = () => setShowPlayBtn(false);
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const isInstagram = video.video_url?.includes('instagram.com');

    // ── Helpers ──────────────────────────────────────────────
    const getMultiplierColorClass = (m) => {
        if (m >= 7) return 'multiplier-high';
        if (m >= 3) return 'multiplier-medium';
        return 'multiplier-low';
    };

    const getEmoji = (m) => {
        if (m >= 25) return '💥';
        if (m >= 15) return '🧨';
        if (m >= 10) return '💎';
        if (m >= 5) return '🚀';
        if (m >= 2) return '🔥';
        return null;
    };

    /** Safe date formatter — shows 'N/A' for invalid/missing dates */
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    /** Safe creator — hides the generic fallback values */
    const formatCreator = (creator) => {
        if (!creator || creator === 'Creator' || creator === 'creator') return null;
        return creator.replace(/^@/, '');
    };

    /** Safe views formatter */
    const formatViews = (v) => {
        if (!v) return '—';
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
        return String(v);
    };

    const multiplier = parseFloat(video.multiplier) || 0;
    const emoji = getEmoji(multiplier);
    const creatorHandle = formatCreator(video.creator);

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>

            {/* Single unified close button, always at top-right of backdrop */}
            <button className="modal-backdrop-close" onClick={onClose} aria-label="Close modal">✕</button>

            {isInstagram ? (
                /* ─── INSTAGRAM CARD ─────────────────────────────────── */
                <div className="ig-card">
                    <div className="ig-frame-wrap">
                        {/* iframe loads immediately */}
                        <iframe
                            src={video.embed_url}
                            className="ig-iframe"
                            allow="autoplay; encrypted-media"
                            scrolling="no"
                            title={video.title || 'Instagram Reel'}
                        />
                        <div className="ig-bottom-mask"></div>

                        {/* Play button — pointer-events:none, click falls through to iframe */}
                        {showPlayBtn && (
                            <div className="ig-play-overlay">
                                <div className="ig-play-btn">
                                    <Play fill="currentColor" size={28} />
                                </div>
                            </div>
                        )}

                        {/* Outlier score badge */}
                        {multiplier > 0 && (
                            <div className="ig-meta-top">
                                <div className={`ig-multiplier-badge ${getMultiplierColorClass(multiplier)}`}>
                                    {emoji && <span className="badge-emoji">{emoji}</span>}{multiplier}x
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="ig-meta-bottom-group">
                        <div className="ig-video-title-bottom">{video.title}</div>
                        <div className="ig-metadata-grid">
                            <div className="ig-meta-col">
                                <span className="ig-meta-label">VIEWS</span>
                                <span className="ig-meta-value">{formatViews(video.views)}</span>
                            </div>
                            <div className="ig-meta-col">
                                <span className="ig-meta-label">PUBLISHED</span>
                                <span className="ig-meta-value">{formatDate(video.date_posted)}</span>
                            </div>
                            {creatorHandle && (
                                <div className="ig-meta-col ig-meta-col-creator">
                                    <span className="ig-meta-label">CREATOR</span>
                                    <span className="ig-meta-value creator-handle" title={`@${creatorHandle}`}>
                                        @{creatorHandle}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            ) : (
                /* ─── YOUTUBE / STANDARD LAYOUT ─────────────────────── */
                <div className="modal-content vertical-video">
                    <div className="video-container">
                        {isPlaying ? (
                            <iframe
                                src={video.embed_url + (video.embed_url?.includes('?') ? '&' : '?') + 'autoplay=1'}
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

                                {/* Outlier score badge over thumbnail */}
                                {multiplier > 0 && (
                                    <div className="yt-score-badge-wrap">
                                        <div className={`ig-multiplier-badge ${getMultiplierColorClass(multiplier)}`}>
                                            {emoji && <span className="badge-emoji">{emoji}</span>}{multiplier}x
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="standard-modal-info">
                        <h3>{video.title}</h3>
                        <div className="yt-meta-row">
                            <span className="yt-meta-item">{formatViews(video.views)} views</span>
                            {formatDate(video.date_posted) !== 'N/A' && (
                                <span className="yt-meta-item">{formatDate(video.date_posted)}</span>
                            )}
                            {creatorHandle && (
                                <span className="yt-meta-item yt-creator">@{creatorHandle}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VideoModal;
