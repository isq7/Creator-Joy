import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import OutlierCard from './OutlierCard';
import AssetCard from './AssetCard';
import LoadingSpinner from './LoadingSpinner';
import CustomDropdown from './CustomDropdown';
import RangeSlider from './RangeSlider';
import SliderDropdown from './SliderDropdown';
import './HomeScreen.css';

function HomeScreen({ onPlatformSelect, platform, outliers, generatedContent = [], sourceVideos = [], avatarVideos = [], bookmarks = [], onVideoClick, isLoading, currentView, onAction, onViewChange, onImageClick, onToggleBookmark, searchQuery = '', onSearchChange }) {
    // 1. All Hooks first (Rules of Hooks)
    const [sortBy, setSortBy] = useState('multiplier_desc'); // keeps sorting global or we can scope it later
    const isGeneratedView = ['idea', 'title', 'thumbnail', 'avatar_video'].includes(currentView);
    const isBookmarksView = currentView === 'bookmarks';
    const isHomeView = currentView === 'home';

    // Scoped state for each view to keep filters and visibility individual
    // Everyone gets the same structure to prevent "undefined" crashes
    const defaultFilters = {
        outlierScore: { min: 1, max: 500 },
        views: { min: '1k', max: '10M' },
        dateRange: 'all'
    };

    const [viewStates, setViewStates] = useState({
        home: { showFilters: false, filters: { ...defaultFilters } },
        bookmarks: { showFilters: false, filters: { ...defaultFilters } },
        idea: { showFilters: false, filters: { ...defaultFilters } },
        title: { showFilters: false, filters: { ...defaultFilters } },
        thumbnail: { showFilters: false, filters: { ...defaultFilters } },
        avatar_video: { showFilters: false, filters: { ...defaultFilters } },
        trackers: { showFilters: false, filters: { ...defaultFilters } }
    });

    const currentViewState = viewStates?.[currentView] || viewStates?.home || { showFilters: false, filters: defaultFilters };
    const activeFilters = currentViewState?.filters || defaultFilters;
    const activeShowFilters = currentViewState?.showFilters || false;
    const activeDateRange = activeFilters?.dateRange || 'all';


    const getPageTitle = () => {
        switch (currentView) {
            case 'idea': return 'Scripts Generated';
            case 'title': return 'Titles Generated';
            case 'thumbnail': return 'Thumbnails Generated';
            case 'avatar_video': return 'Avatar Videos Generated';
            default: return 'Outliers related to your channel';
        }
    };

    // Helper to parse relative time into days for filtering
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

    const dateRangeOptions = {
        'all': 'All time',
        '24h': 'Last 24 hours',
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days'
    };

    const dateRangeDays = {
        'all': Infinity,
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
    };

    // Filter and sort for Asset views and Bookmarks
    const filteredAssets = useMemo(() => {
        if (!isGeneratedView && currentView !== 'bookmarks') return [];

        // Special handling for avatar videos
        if (currentView === 'avatar_video') {
            let result = [...avatarVideos];

            // Apply date filter if available
            if (activeDateRange !== 'all') {
                const daysLimit = dateRangeDays[activeDateRange];
                result = result.filter(item => {
                    if (!item.created_at) return false;
                    const createdDate = new Date(item.created_at);
                    const diffDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
                    return diffDays >= 0 && diffDays <= daysLimit;
                });
            }

            return result.filter(item => {
                if (!searchQuery) return true;
                const searchLower = searchQuery.toLowerCase();
                return (item.video_url || '').toLowerCase().includes(searchLower);
            });
        }

        // Special handling for Bookmarks
        if (currentView === 'bookmarks') {
            let result = [...bookmarks];

            // Apply date filter
            if (activeDateRange !== 'all') {
                const daysLimit = dateRangeDays[activeDateRange];
                result = result.filter(item => {
                    const dateField = item.bookmarked_at || item.date_posted;
                    if (!dateField) return false;
                    const createdDate = new Date(dateField);
                    const diffDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
                    return diffDays >= 0 && diffDays <= daysLimit;
                });
            }

            return result.filter(item => {
                if (!searchQuery) return true;
                const searchLower = searchQuery.toLowerCase();
                return (item.title || '').toLowerCase().includes(searchLower) ||
                    (item.creator || '').toLowerCase().includes(searchLower);
            });
        }

        const typeMap = { 'idea': 'script', 'title': 'title', 'thumbnail': 'thumbnail' };
        const targetType = typeMap[currentView];

        let result = generatedContent.filter(item => item.type === targetType);

        // Date filter for assets
        if (activeDateRange !== 'all') {
            const daysLimit = dateRangeDays[activeDateRange];
            result = result.filter(item => {
                if (!item.created_at) return false;
                const createdDate = new Date(item.created_at);
                const diffDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
                return diffDays >= 0 && diffDays <= daysLimit;
            });
        }

        return result
            .filter(item => {
                if (!searchQuery) return true;
                const searchLower = searchQuery.toLowerCase();
                return (item.content || '').toLowerCase().includes(searchLower) ||
                    (item.video_id || '').toLowerCase().includes(searchLower);
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [generatedContent, avatarVideos, bookmarks, currentView, isGeneratedView, searchQuery, viewStates]);

    // Filter and sort outliers based on search and filters
    const filteredOutliers = useMemo(() => {
        if (isGeneratedView || currentView === 'bookmarks' || !outliers) return [];

        let result = outliers.filter(video => {
            // Search filter - check title or creator
            const searchLower = searchQuery.toLowerCase();
            if (searchQuery &&
                !(video.title || '').toLowerCase().includes(searchLower) &&
                !(video.creator || '').toLowerCase().includes(searchLower)) {
                return false;
            }

            // Shorthand parser for K, M, B
            const parseShorthand = (val) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const normalized = val.toString().toLowerCase().trim();
                const multiplier = normalized.endsWith('k') ? 1000 :
                    normalized.endsWith('m') ? 1000000 :
                        normalized.endsWith('b') ? 1000000000 : 1;
                const num = parseFloat(normalized) || 0;
                return num * multiplier;
            };

            // Multiplier filter
            const multiplier = parseFloat(video.multiplier) || 0;
            const minMultiplier = (activeFilters?.outlierScore?.min === '' || activeFilters?.outlierScore?.min === undefined) ? 0 : parseShorthand(activeFilters.outlierScore.min);
            const maxMultiplier = (activeFilters?.outlierScore?.max === '' || activeFilters?.outlierScore?.max === undefined) ? Infinity : parseShorthand(activeFilters.outlierScore.max);

            if (multiplier < minMultiplier || multiplier > maxMultiplier) {
                return false;
            }

            // Views filter
            const minViews = (activeFilters?.views?.min === '' || activeFilters?.views?.min === undefined) ? 0 : parseShorthand(activeFilters.views.min);
            const maxViews = (activeFilters?.views?.max === '' || activeFilters?.views?.max === undefined) ? Infinity : parseShorthand(activeFilters.views.max);

            if (video.views < minViews || video.views > maxViews) {
                return false;
            }

            // Date filter
            if (activeDateRange !== 'all') {
                const daysLimit = dateRangeDays[activeDateRange];
                const videoDays = parseTimeToDays(video.relative_time);
                if (videoDays > daysLimit) return false;
            }

            return true;
        });

        // Apply sorting
        return result.sort((a, b) => {
            const multA = parseFloat(a.multiplier) || 0;
            const multB = parseFloat(b.multiplier) || 0;

            if (sortBy === 'multiplier_desc') {
                return multB - multA;
            } else {
                return multA - multB;
            }
        });
    }, [outliers, searchQuery, viewStates, sortBy, isGeneratedView, currentView]);

    // Find the highest multiplier in the current result set
    const maxMultiplier = useMemo(() => {
        if (filteredOutliers.length === 0) return 0;
        return Math.max(...filteredOutliers.map(v => parseFloat(v.multiplier) || 0));
    }, [filteredOutliers]);

    // 2. Helper functions
    const handleFilterChange = (filterType, value) => {
        setViewStates(prev => {
            const current = prev[currentView] || prev.home;
            return {
                ...prev,
                [currentView]: {
                    ...current,
                    filters: { ...current.filters, [filterType]: value }
                }
            };
        });
    };

    const toggleFilters = () => {
        setViewStates(prev => {
            const current = prev[currentView] || prev.home;
            return {
                ...prev,
                [currentView]: { ...current, showFilters: !current.showFilters }
            };
        });
    };

    const clearAllFilters = () => {
        setViewStates(prev => ({
            ...prev,
            [currentView]: {
                ...prev[currentView],
                filters: { ...defaultFilters }
            }
        }));
        setSearchQuery('');
    };

    const handleEmptyButtonClick = () => {
        if (isGeneratedView || currentView === 'bookmarks') {
            onViewChange('home');
        } else {
            clearAllFilters();
        }
    };

    const platformLabels = {
        youtube: 'YouTube',
        instagram: 'Instagram',
        facebook: 'Facebook'
    };

    // 3. Conditional Rendering (after hooks)
    // Platform selection screen - shown when no platform is selected
    if (!platform) {
        return (
            <div className="home-screen">
                <div className="platform-selection">
                    <h1 className="selection-title">Select Platform</h1>
                    <div className="platform-buttons">
                        <button
                            className="platform-button youtube"
                            onClick={() => onPlatformSelect('youtube')}
                            disabled={isLoading}
                        >
                            <span className="platform-icon">📺</span>
                            <span className="platform-label">YouTube</span>
                        </button>
                        <button
                            className="platform-button instagram"
                            onClick={() => onPlatformSelect('instagram')}
                            disabled={isLoading}
                        >
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

    // Main Content (Results)
    const hasResults = (isGeneratedView || isBookmarksView) ? filteredAssets.length > 0 : filteredOutliers.length > 0;



    return (
        <div className="home-screen">
            <div className="main-content">
                {/* Header Section */}
                <div className="search-filters-section">
                    <div className="header-top-row">
                        <h1 className="page-title">
                            {getPageTitle()}
                            <span className="info-icon-small">ⓘ</span>
                        </h1>
                        <div className="header-actions">
                            <button
                                className={`action-btn-pill filters ${activeShowFilters ? 'active' : ''}`}
                                onClick={toggleFilters}
                            >
                                <span className="icon">⚙️</span>
                                Filters
                            </button>
                        </div>
                    </div>

                    {activeShowFilters && (
                        <div className="filters-horizontal-bar">
                            {/* Only show views and multiplier filters for outlier view or bookmarks (since they are videos) */}
                            {(!isGeneratedView || currentView === 'bookmarks') && (
                                <>
                                    <SliderDropdown
                                        label="Outlier Score"
                                        min={1}
                                        max={500}
                                        step={1}
                                        value={{
                                            min: activeFilters?.outlierScore?.min || 1,
                                            max: activeFilters?.outlierScore?.max || 500
                                        }}
                                        onChange={(val) => handleFilterChange('outlierScore', val)}
                                        unit="x"
                                        colorClass="outlier-picker"
                                    />

                                    <SliderDropdown
                                        label="Views"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={(() => {
                                            const parseShorthandToSlider = (val) => {
                                                if (!val) return 0;
                                                const normalized = val.toString().toLowerCase().trim();
                                                const num = parseFloat(normalized);
                                                if (normalized.endsWith('k')) return (Math.log10(num * 1000) - 3) * 25;
                                                if (normalized.endsWith('m')) return (Math.log10(num * 1000000) - 3) * 25;
                                                return (Math.log10(num || 1000) - 3) * 25;
                                            };
                                            return {
                                                min: parseShorthandToSlider(activeFilters?.views?.min || '1k'),
                                                max: parseShorthandToSlider(activeFilters?.views?.max || '10M')
                                            };
                                        })()}
                                        onChange={(val) => {
                                            const sliderToShorthand = (sVal) => {
                                                const totalVal = Math.pow(10, (sVal / 25) + 3);
                                                if (totalVal >= 1000000) return `${Math.round(totalVal / 1000000)}M`;
                                                if (totalVal >= 1000) return `${Math.round(totalVal / 1000)}k`;
                                                return `${Math.round(totalVal)}`;
                                            };
                                            handleFilterChange('views', {
                                                min: sliderToShorthand(val.min),
                                                max: sliderToShorthand(val.max)
                                            });
                                        }}
                                        formatValue={(sVal) => {
                                            const totalVal = Math.pow(10, (sVal / 25) + 3);
                                            if (totalVal >= 1000000) return `${Math.round(totalVal / 1000000)}M`;
                                            if (totalVal >= 1000) return `${Math.round(totalVal / 1000)}k`;
                                            return Math.round(totalVal);
                                        }}
                                        colorClass="views-picker"
                                    />
                                </>
                            )}

                            <CustomDropdown
                                label={isGeneratedView ? "Created" : "Posted"}
                                value={activeDateRange}
                                options={Object.entries(dateRangeOptions).map(([value, label]) => ({ value, label }))}
                                onChange={(val) => handleFilterChange('dateRange', val)}
                                colorClass="date-chip"
                            />

                            {(!isGeneratedView || currentView === 'bookmarks') && (
                                <CustomDropdown
                                    label="Sort"
                                    value={sortBy}
                                    options={[
                                        { value: 'multiplier_desc', label: 'Multiplier: High to Low' },
                                        { value: 'multiplier_asc', label: 'Multiplier: Low to High' }
                                    ]}
                                    onChange={setSortBy}
                                    colorClass="sort-chip"
                                />
                            )}

                            <button className="clear-all-link" onClick={clearAllFilters}>
                                Clear all filters
                            </button>
                        </div>
                    )}
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
                        {(searchQuery || isGeneratedView || currentView === 'bookmarks' || JSON.stringify(activeFilters) !== JSON.stringify({
                            outlierScore: { min: 1, max: 500 },
                            views: { min: '1k', max: '10M' },
                            dateRange: 'all'
                        })) && (
                                <button className="retry-button" onClick={handleEmptyButtonClick}>
                                    {isGeneratedView || currentView === 'bookmarks' ? 'Back to Home' : 'Clear filters'}
                                </button>
                            )}
                    </div>
                ) : (
                    <div className="outliers-container">
                        <motion.div
                            layout
                            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            className={`outliers-grid ${isGeneratedView ? 'assets-grid' : ''}`}
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
                                    // Debug log to help diagnose ID mismatches
                                    if (filteredAssets.length > 0 && sourceVideos.length === 0) {
                                        console.warn('[AssetCard] sourceVideos is empty — source video thumbnails will not show.');
                                    } else if (filteredAssets.length > 0) {
                                        console.log('[AssetCard] Matching assets to sourceVideos:', {
                                            assetVideoIds: [...new Set(filteredAssets.map(a => a.video_id))],
                                            sourceVideoIds: sourceVideos.map(v => ({ video_id: v.video_id, id: v.id })),
                                        });
                                    }
                                    return filteredAssets.map((asset, index) => {
                                        // Match by platform video_id, DB UUID id, or preserved _rawId
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

                                // Default Home Case
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
