import React from 'react';
import './VideoTile.css';

const VideoTile = ({ video }) => {
    const formatViews = (views) => {
        if (views >= 1000000) {
            return `${(views / 1000000).toFixed(1)}M`;
        } else if (views >= 1000) {
            return `${(views / 1000).toFixed(0)}K`;
        }
        return views.toString();
    };

    const getTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 365) {
            return '1y ago';
        }
        return '1y ago';
    };

    return (
        <div className="video-tile">
            <div className="thumbnail-section">
                <div className="video-thumbnail">
                    <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="thumbnail-image"
                    />
                    <div className="duration-overlay">
                        {video.duration || '11:07'}
                    </div>
                </div>
            </div>

            <div className="content-section">
                <h3 className="video-title">{video.title}</h3>

                <div className="meta-info">
                    <div className="channel-row">
                        <span className="channel-name">@{video.creator}</span>
                        <span className="time-ago">{getTimeAgo(video.date_posted)}</span>
                    </div>
                </div>

                <div className="stats-section">
                    <div className="outlier-badge">
                        <span className="badge-label">Outlier Score</span>
                        <span className="badge-value">{video.multiplier}x</span>
                    </div>

                    <div className="views-stats">
                        <div className="views-column">
                            <div className="stat-item">
                                <span className="stat-label">Views</span>
                                <span className="stat-value">{formatViews(video.views)}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Avg Views</span>
                                <span className="stat-value">{formatViews(video.median_views)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoTile;
