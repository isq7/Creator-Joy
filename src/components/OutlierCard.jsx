import { motion } from 'framer-motion';
import { Bookmark, FileText, Image, Type, Video, Sparkles } from 'lucide-react';
import { triggerN8nWebhook } from '../services/api';
import InstagramEmbed from './InstagramEmbed';
import './OutlierCard.css';

/**
 * Formats view count to human-readable format
 * @param {number} views 
 * @returns {string}
 */
function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000000) {
        return Math.floor(views / 1000000000) + 'B';
    }
    if (views >= 1000000) {
        return Math.floor(views / 1000000) + 'M';
    }
    if (views >= 1000) {
        return Math.floor(views / 1000) + 'K';
    }
    return views.toString();
}

/**
 * Get multiplier badge color based on multiplier value
 * @param {number} multiplier 
 * @returns {string} CSS class name
 */
function getMultiplierColorClass(multiplier) {
    if (multiplier >= 7) return 'multiplier-high';
    if (multiplier >= 3) return 'multiplier-medium';
    return 'multiplier-low';
}

/**
 * Get tiered emoji data based on multiplier value
 * @param {number} multiplier 
 * @param {boolean} isHighest 
 * @returns {object} { emoji, class }
 */
function getEmojiData(multiplier, isHighest) {
    if (isHighest) return { emoji: '👑', class: 'emoji-king' };
    if (multiplier >= 25) return { emoji: '💥', class: 'emoji-nuclear' };
    if (multiplier >= 15) return { emoji: '🧨', class: 'emoji-explosive' };
    if (multiplier >= 10) return { emoji: '💎', class: 'emoji-diamond' };
    if (multiplier >= 5) return { emoji: '🚀', class: 'emoji-rocket' };
    if (multiplier >= 2) return { emoji: '🔥', class: 'emoji-fire' };
    return { emoji: null, class: 'emoji-none' };
}

/**
 * Formats multiplier to show consistent significant digits
 * @param {number} multiplier 
 * @returns {string}
 */
function formatMultiplier(multiplier) {
    const num = parseFloat(multiplier) || 0;
    if (num >= 10) {
        return num.toFixed(1);
    }
    return num.toFixed(2);
}

function OutlierCard({ video, onVideoClick, isHighest, currentView, onAction, isBookmarked, onToggleBookmark }) {
    const emojiData = getEmojiData(video.multiplier, isHighest);
    const formattedMultiplier = formatMultiplier(video.multiplier);

    const handleAction = (e, action) => {
        e.stopPropagation();
        if (onAction) {
            onAction(action, video);
        }
    };

    const handleSave = (e) => {
        e.stopPropagation();
        if (onToggleBookmark) {
            onToggleBookmark(video);
        }
    };

    const handleClick = () => {
        onVideoClick(video);
    };

    // Determine if we should show overlays (only in home view)
    const showOverlays = currentView === 'home';

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.2 }
            }}
            className={`outlier-card ${isHighest ? 'is-highest' : ''}`}
            onClick={handleClick}
        >
            <div className="card-thumbnail">
                <motion.img
                    layout
                    src={video.thumbnail}
                    alt={video.title || 'Video thumbnail'}
                    loading="lazy"
                    onError={(e) => {
                        e.target.src = `https://images.placeholders.dev/?width=640&height=360&text=IG-Thumbnail&bgColor=%230a0a0a&textColor=%23ffffff`;
                    }}
                />

                {/* Save Button Overlay */}
                <button
                    className={`save-btn-overlay ${isBookmarked ? 'is-saved' : ''}`}
                    onClick={handleSave}
                    title={isBookmarked ? "Remove from bookmarks" : "Save video"}
                >
                    <Bookmark
                        size={24}
                        fill={isBookmarked ? "white" : "none"}
                        strokeWidth={2}
                        color={isBookmarked ? "white" : "white"}
                    />
                </button>

                {/* Hover Action Dock */}
                {showOverlays && (
                    <div className="action-dock">
                        <button
                            className="dock-btn"
                            onClick={(e) => handleAction(e, 'script')}
                            data-label="Script"
                            style={{ '--index': 0 }}
                        >
                            <FileText size={20} />
                        </button>
                        <button
                            className="dock-btn"
                            onClick={(e) => handleAction(e, 'thumbnail')}
                            data-label="Thumbnail"
                            style={{ '--index': 1 }}
                        >
                            <Image size={20} />
                        </button>
                        <button
                            className="dock-btn"
                            onClick={(e) => handleAction(e, 'title')}
                            data-label="Title"
                            style={{ '--index': 2 }}
                        >
                            <Type size={20} />
                        </button>
                        <button
                            className="dock-btn"
                            onClick={(e) => handleAction(e, 'avatar_video')}
                            data-label="Video"
                            style={{ '--index': 3 }}
                        >
                            <Video size={20} />
                        </button>
                    </div>
                )}
            </div>

            <div className="card-info">
                {/* Title Row with Multiplier Badge moved back to original */}
                <div className="title-row">
                    <h3 className="card-title" title={video.title || 'Original video has no caption'}>
                        <span className={`multiplier-badge ${getMultiplierColorClass(video.multiplier)}`}>
                            {emojiData.emoji && <span className="badge-emoji">{emojiData.emoji}</span>}{formattedMultiplier}x
                        </span>
                        {video.title || <span style={{ opacity: 0.5, fontStyle: 'italic', fontWeight: 400 }}>(Video has no caption)</span>}
                    </h3>
                </div>

                {/* Creator Row */}
                <div className="creator-row">
                    <span className="creator-name">@{video.creator}</span>
                </div>

                {/* Stats Row */}
                <div className="stats-row">
                    <p className="view-comparison">
                        {formatViews(video.views)} views vs {formatViews(video.median_views)} avg
                    </p>
                    <p className="post-time">{video.relative_time}</p>
                </div>
            </div>
        </motion.div >
    );
}

export default OutlierCard;
