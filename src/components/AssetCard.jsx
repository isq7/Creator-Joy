import React from 'react';
import { Sparkles, Type, Image, FileText, Video, PlayCircle } from 'lucide-react';
import './AssetCard.css';

function AssetCard({ asset, sourceVideo, onVideoClick, onImageClick }) {
    const { type, content, created_at, video_url, thumbnail_url } = asset;


    const getIcon = () => {
        switch (type) {
            case 'title': return <Type size={14} />;
            case 'script': return <FileText size={14} />;
            case 'thumbnail': return <Image size={14} />;
            case 'avatar_video': return <Video size={14} />;
            default: return <Sparkles size={14} />;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };


    // Content cleaning
    const rawContent = String(content || '').trim();
    let processedText = rawContent.replace(/['\"]/g, '');
    let cleanUrl = '';
    let displayContent = '';

    if (type === 'thumbnail') {
        cleanUrl = processedText.replace(/\s+/g, '_');
        try { cleanUrl = encodeURI(cleanUrl); } catch (e) { }
    } else {
        displayContent = processedText
            .replace(/^(Title:|Script:)\s*/i, '')
            .replace(/_/g, ' ')
            .trim();
    }

    const handleThumbnailClick = (e) => {
        if (onImageClick && cleanUrl) {
            e.stopPropagation();
            onImageClick(cleanUrl, `Generated for: ${sourceVideo?.title || 'Video'}`);
        }
    };

    return (
        <div className={`asset-card type-${type}`}>
            {/* Top meta row */}
            <div className="asset-top-meta">
                <div className={`asset-type-badge type-${type}`}>
                    {getIcon()}
                    <span>{type === 'script' ? 'Script Idea' : type === 'avatar_video' ? 'Avatar Video' : type.charAt(0).toUpperCase() + type.slice(1)}</span>
                </div>
                <div className="asset-date">{formatDate(created_at)}</div>
            </div>

            {/* SOURCE VIDEO SECTION */}
            {sourceVideo && (
                <div className="asset-source-section">
                    <div className="section-label">SOURCE VIDEO</div>

                    <div
                        className="source-video-block"
                        onClick={() => onVideoClick && onVideoClick(sourceVideo)}
                        title="Click to watch video"
                    >
                        {/* Thumbnail */}
                        <div className="source-thumb-large">
                            <img
                                src={sourceVideo.thumbnail}
                                alt={sourceVideo.title}
                                onError={(e) => {
                                    e.target.src = 'https://images.placeholders.dev/?width=640&height=360&text=No+Preview&bgColor=%230a0a0a&textColor=%23444';
                                }}
                            />
                            <div className="source-play-overlay">
                                <div className="source-play-btn">
                                    <PlayCircle size={18} fill="white" color="white" strokeWidth={1.5} />
                                </div>
                                <div className="source-hover-bg" />
                            </div>
                        </div>

                        {/* Multiplier badge pinned to top-right of the tile */}
                        {sourceVideo.multiplier > 0 && (
                            <div className={`source-score-badge source-score-badge--corner ${sourceVideo.multiplier >= 7 ? 'score-high' :
                                    sourceVideo.multiplier >= 3 ? 'score-medium' : 'score-low'
                                }`}>
                                {sourceVideo.multiplier >= 25 ? '💥' :
                                    sourceVideo.multiplier >= 15 ? '🧨' :
                                        sourceVideo.multiplier >= 10 ? '💎' :
                                            sourceVideo.multiplier >= 5 ? '🚀' :
                                                sourceVideo.multiplier >= 2 ? '🔥' : null}
                                {sourceVideo.multiplier >= 2 && ' '}
                                {parseFloat(sourceVideo.multiplier).toFixed(1)}x
                            </div>
                        )}

                        <div className="source-video-meta">
                            {sourceVideo.title ? (
                                <div className="source-video-title">{sourceVideo.title}</div>
                            ) : (
                                <div className="source-video-title source-video-title--empty">Untitled Video</div>
                            )}
                            {/* Creator — always show if not the generic 'Creator' default */}
                            {sourceVideo.creator && sourceVideo.creator !== 'Creator' && (
                                <div className="source-video-creator">@{String(sourceVideo.creator).replace(/^@/, '')}</div>
                            )}
                            {/* Published date — use relative_time if available, fallback to formatted date */}
                            {(sourceVideo.relative_time || sourceVideo.date_posted) && (
                                <div className="source-video-date">
                                    {sourceVideo.relative_time || (() => {
                                        const d = new Date(sourceVideo.date_posted);
                                        return isNaN(d.getTime()) ? null :
                                            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* GENERATED CONTENT SECTION */}
            <div className="asset-result-section">
                <div className="section-label">GENERATED {type === 'avatar_video' ? 'VIDEO' : type.toUpperCase()}</div>

                <div className="result-content">
                    {type === 'avatar_video' ? (
                        <div className="asset-video-preview">
                            {video_url ? (
                                <video controls poster={thumbnail_url} className="avatar-video-player">
                                    <source src={video_url} type="video/mp4" />
                                </video>
                            ) : (
                                <div className="empty-video">
                                    <Video size={40} color="rgba(255,255,255,0.2)" />
                                    <span>No video available</span>
                                </div>
                            )}
                        </div>
                    ) : type === 'thumbnail' ? (
                        <div
                            className="asset-thumbnail-preview clickable"
                            onClick={handleThumbnailClick}
                            title="Click to view full image"
                        >
                            {cleanUrl ? (
                                <img
                                    src={cleanUrl}
                                    alt={`Generated thumbnail`}
                                    onError={(e) => {
                                        e.target.src = `https://images.placeholders.dev/?width=640&height=360&text=Unable%20to%20load%20Image&bgColor=%230a0a0a&textColor=%23ffffff`;
                                    }}
                                />
                            ) : (
                                <div className="empty-thumbnail">
                                    <Image size={40} color="rgba(255,255,255,0.2)" />
                                    <span>No thumbnail link found</span>
                                </div>
                            )}
                            <div className="expand-indicator">↗</div>
                        </div>
                    ) : (
                        <div className="asset-text-preview">
                            {displayContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AssetCard;
