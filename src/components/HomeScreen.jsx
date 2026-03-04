import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import OutlierCard from './OutlierCard';
import AssetCard from './AssetCard';
import LoadingSpinner from './LoadingSpinner';
import FiltersPanel from './FiltersPanel';
import './HomeScreen.css';

const DEFAULT_FILTERS = {
    outlierScore: { min: 1, max: 250 },
    views: { min: '1k', max: '1B' },
    subscribers: { min: '1k', max: '50M' },
    dateRange: 'all',
};

const DATE_RANGE_DAYS = {
    'all': Infinity,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '365d': 365,
    '730d': 730,
};

function HomeScreen({ onPlatformSelect, platform, outliers, generatedContent = [], sourceVideos = [], avatarVideos = [], bookmarks = [], onVideoClick, isLoading, currentView, onAction, onViewChange, onImageClick, onToggleBookmark, searchQuery = '', onSearchChange }) {
    const [sortBy, setSortBy] = useState('multiplier_desc');
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [columns, setColumns] = useState(4);

    const isGeneratedView = ['idea', 'title', 'thumbnail', 'avatar_video'].includes(currentView);
    const isBookmarksView = currentView === 'bookmarks';

    const getPageTitle = () => {
        switch (currentView) {
            case 'idea': return 'Scripts Generated';
            case 'title': return 'Titles Generated';
            case 'thumbnail': return 'Thumbnails Generated';
            case 'avatar_video': return 'Avatar Videos Generated';
            default: return 'Outliers related to your channel';
        }
    };

    // Helper: parse "1w ago" → days
    const parseTimeToDays = (relativeTime) => {
        if (!relativeTime) return 9999;
        const time = relativeTime.toLowerCase();
        const value = parseInt(time) || 0;
        if (time.includes('h')) return value / 24;
        if (time.includes('d')) return value;
        if (time.includes('w')) return value * 7;
        if (time.includes('mo') || (time.includes('m') && !time.includes('h'))) return value * 30;
        if (time.includes('y')) return value * 365;
        return 9999;
    };

    // Helper: parse shorthand like "1k", "2.5M", "1B" → number
    const parseShorthand = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const n = val.toString().toLowerCase().trim();
        const mult = n.endsWith('b') ? 1e9 : n.endsWith('m') ? 1e6 : n.endsWith('k') ? 1e3 : 1;
        return (parseFloat(n) || 0) * mult;
    };

    // Filter assets (generated content, avatars, bookmarks)
    const filteredAssets = useMemo(() => {
        if (!isGeneratedView && currentView !== 'bookmarks') return [];

        if (currentView === 'avatar_video') {
            let r = [...avatarVideos];
            if (filters.dateRange !== 'all') {
                const lim = DATE_RANGE_DAYS[filters.dateRange];
                r = r.filter(i => {
                    if (!i.created_at) return false;
                    return (new Date() - new Date(i.created_at)) / 86400000 <= lim;
                });
            }
            return r.filter(i => !searchQuery || (i.video_url || '').toLowerCase().includes(searchQuery.toLowerCase()));
        }

        if (currentView === 'bookmarks') {
            let r = [...bookmarks];
            if (filters.dateRange !== 'all') {
                const lim = DATE_RANGE_DAYS[filters.dateRange];
                r = r.filter(i => {
                    const d = i.bookmarked_at || i.date_posted;
                    if (!d) return false;
                    return (new Date() - new Date(d)) / 86400000 <= lim;
                });
            }
            return r.filter(i => !searchQuery || (i.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (i.creator || '').toLowerCase().includes(searchQuery.toLowerCase()));
        }

        const typeMap = { idea: 'script', title: 'title', thumbnail: 'thumbnail' };
        let r = generatedContent.filter(i => i.type === typeMap[currentView]);
        if (filters.dateRange !== 'all') {
            const lim = DATE_RANGE_DAYS[filters.dateRange];
            r = r.filter(i => {
                if (!i.created_at) return false;
                return (new Date() - new Date(i.created_at)) / 86400000 <= lim;
            });
        }
        return r
            .filter(i => !searchQuery || (i.content || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [generatedContent, avatarVideos, bookmarks, currentView, isGeneratedView, searchQuery, filters.dateRange]);

    // Filter & sort outliers
    const filteredOutliers = useMemo(() => {
        if (isGeneratedView || currentView === 'bookmarks' || !outliers) return [];

        let r = outliers.filter(video => {
            const sl = searchQuery.toLowerCase();
            if (searchQuery && !(video.title || '').toLowerCase().includes(sl) && !(video.creator || '').toLowerCase().includes(sl)) return false;

            const mult = parseFloat(video.multiplier) || 0;
            if (mult < (filters.outlierScore?.min ?? 0) || mult > (filters.outlierScore?.max ?? Infinity)) return false;

            const minV = parseShorthand(filters.views?.min);
            const maxV = filters.views?.max ? parseShorthand(filters.views.max) : Infinity;
            if (video.views < minV || video.views > maxV) return false;

            // Subscriber filter (field: subscribers or subscriber_count)
            const subs = video.subscribers || video.subscriber_count || 0;
            const minS = parseShorthand(filters.subscribers?.min);
            const maxS = filters.subscribers?.max ? parseShorthand(filters.subscribers.max) : Infinity;
            if (subs > 0 && (subs < minS || subs > maxS)) return false;

            if (filters.dateRange !== 'all') {
                const lim = DATE_RANGE_DAYS[filters.dateRange];
                if (parseTimeToDays(video.relative_time) > lim) return false;
            }

            return true;
        });

        return r.sort((a, b) => {
            const mA = parseFloat(a.multiplier) || 0;
            const mB = parseFloat(b.multiplier) || 0;
            return sortBy === 'multiplier_desc' ? mB - mA : mA - mB;
        });
    }, [outliers, searchQuery, filters, sortBy, isGeneratedView, currentView]);

    const maxMultiplier = useMemo(() => {
        if (!filteredOutliers.length) return 0;
        return Math.max(...filteredOutliers.map(v => parseFloat(v.multiplier) || 0));
    }, [filteredOutliers]);

    const handleApplyFilters = (newFilters, newColumns) => {
        setFilters(newFilters);
        setColumns(newColumns);
    };

    const handleEmptyButtonClick = () => {
        if (isGeneratedView || currentView === 'bookmarks') {
            onViewChange('home');
        } else {
            setFilters({ ...DEFAULT_FILTERS });
        }
    };

    // Platform selection screen
    if (!platform) {
        return (
            <div className="home-screen">
                <div className="platform-selection">
                    <h1 className="selection-title">Select Platform</h1>
                    <div className="platform-buttons">
                        <button className="platform-button youtube" onClick={() => onPlatformSelect('youtube')} disabled={isLoading}>
                            <span className="platform-icon">📺</span>
                            <span className="platform-label">YouTube</span>
                        </button>
                        <button className="platform-button instagram" onClick={() => onPlatformSelect('instagram')} disabled={isLoading}>
                            <span className="platform-icon">📷</span>
                            <span className="platform-label">Instagram</span>
                        </button>
                    </div>
                    {isLoading && (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading outliers...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const hasResults = (isGeneratedView || isBookmarksView) ? filteredAssets.length > 0 : filteredOutliers.length > 0;

    return (
        <div className="home-screen">
            <FiltersPanel
                isOpen={showFiltersPanel}
                onClose={() => setShowFiltersPanel(false)}
                filters={filters}
                onApply={handleApplyFilters}
                columns={columns}
                onColumnsChange={setColumns}
            />

            <div className="main-content">
                {/* Header */}
                <div className="search-filters-section">
                    <div className="header-top-row">
                        <h1 className="page-title">
                            {getPageTitle()}
                            <span className="info-icon-small">ⓘ</span>
                        </h1>
                        <div className="header-actions">
                            <button
                                className={`action-btn-pill filters ${showFiltersPanel ? 'active' : ''}`}
                                onClick={() => setShowFiltersPanel(true)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                                </svg>
                                Filters &amp; Views
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading outliers...</p>
                    </div>
                ) : !hasResults ? (
                    <div className="empty-state">
                        <div className="empty-icon">{isGeneratedView || currentView === 'bookmarks' ? '📑' : '📭'}</div>
                        <h2>
                            {currentView === 'bookmarks'
                                ? 'No bookmarks found'
                                : isGeneratedView
                                    ? `No ${currentView === 'idea' ? 'script' : currentView}s found yet`
                                    : `No outliers found${searchQuery ? ' matching your search' : ''}`}
                        </h2>
                        <p>
                            {currentView === 'bookmarks'
                                ? 'Save videos to your bookmarks to see them here.'
                                : isGeneratedView
                                    ? `Generate your first ${currentView === 'idea' ? 'script' : currentView} from the Home feed to see it here.`
                                    : 'Try adjusting your filters or search query.'}
                        </p>
                        <button className="retry-button" onClick={handleEmptyButtonClick}>
                            {isGeneratedView || currentView === 'bookmarks' ? 'Back to Home' : 'Clear filters'}
                        </button>
                    </div>
                ) : (
                    <div className="outliers-container">
                        <motion.div
                            layout
                            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            className={`outliers-grid ${isGeneratedView ? 'assets-grid' : ''}`}
                            style={!isGeneratedView ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
                        >
                            {(() => {
                                if (isBookmarksView) {
                                    return filteredAssets.map((video, index) => (
                                        <OutlierCard
                                            key={`bookmark-${video.video_id || index}`}
                                            video={video}
                                            onVideoClick={onVideoClick}
                                            onAction={onAction}
                                            currentView={currentView}
                                            isBookmarked={true}
                                            onToggleBookmark={onToggleBookmark}
                                        />
                                    ));
                                }

                                if (isGeneratedView) {
                                    return filteredAssets.map((asset, index) => {
                                        const sourceVideo = sourceVideos.find(v =>
                                            (v.video_id && String(v.video_id) === String(asset.video_id)) ||
                                            (v.id && String(v.id) === String(asset.video_id)) ||
                                            (v._rawId && String(v._rawId) === String(asset.video_id))
                                        );
                                        return (
                                            <AssetCard
                                                key={`asset-${asset.id || index}`}
                                                asset={asset}
                                                sourceVideo={sourceVideo}
                                                onVideoClick={onVideoClick}
                                                onImageClick={onImageClick}
                                            />
                                        );
                                    });
                                }

                                return filteredOutliers.map((video, index) => (
                                    <OutlierCard
                                        key={`outlier-${video.video_id || video.video_url || index}`}
                                        video={video}
                                        onVideoClick={onVideoClick}
                                        onAction={onAction}
                                        currentView={currentView}
                                        isHighest={parseFloat(video.multiplier) === maxMultiplier}
                                        isBookmarked={bookmarks && bookmarks.some(b => b.video_id === video.video_id)}
                                        onToggleBookmark={onToggleBookmark}
                                    />
                                ));
                            })()}
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HomeScreen;
