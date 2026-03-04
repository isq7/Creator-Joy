// API service for Supabase data fetching
import { supabase, supabaseService } from '../lib/supabaseClient';

const VIEW_NAME = import.meta.env.VITE_SUPABASE_VIEW_NAME || 'ui_videos_view';

/**
 * Calculates relative time from a date (e.g., "1y ago", "3mo ago", "2w ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
function getRelativeTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) return `${diffYears}y ago`;
    if (diffMonths > 0) return `${diffMonths}mo ago`;
    if (diffWeeks > 0) return `${diffWeeks}w ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'just now';
}

/**
 * Generates a placeholder duration based on video ID or returns actual duration if available
 * @param {Object} video - Video object
 * @returns {string} Duration string (e.g., "10:07")
 */
function getDuration(video) {
    // If duration is available in the data, use it
    if (video.duration) return video.duration;

    // Otherwise generate a placeholder between 5-25 minutes
    const hash = video.video_id ? video.video_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const minutes = (hash % 20) + 5; // 5-24 minutes
    const seconds = (hash % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const isLocal = window.location.hostname === 'localhost';

/**
 * Transforms Supabase response to the format expected by the UI
 * @param {Array} rawData - Array of video objects from Supabase
 * @param {string} platform - Platform name
 * @returns {Object} Formatted response with outliers array
 */
function transformSupabaseResponse(rawData, platform) {
    console.log('transformSupabaseResponse called with:', { rawData, platform });

    if (!Array.isArray(rawData)) {
        return { platform, outliers: [] };
    }

    const outliers = rawData.map((video) => {
        const videoId = video.video_id || video.id || video.video_url?.split('/').pop()?.split('?')[0] || Math.random().toString(36).substring(7);

        // Generate embed URL based on platform
        let embedUrl = null;
        let thumbnail = video.thumbnail_url;

        if (video.platform === 'youtube' && video.video_url) {
            const yid = video.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\n?#]+)/)?.[1];
            if (yid) {
                embedUrl = `https://www.youtube.com/embed/${yid}`;
            }
        } else if (video.platform === 'instagram' && video.video_url) {
            const shortcode = video.video_url.match(/(?:instagram\.com\/(?:p|reel|reels)\/)([^/?#&]+)/)?.[1];
            if (shortcode) {
                embedUrl = `https://www.instagram.com/p/${shortcode}/embed`;
                // Use the stored thumbnail directly without proxy
                thumbnail = video.thumbnail_url || `https://images.placeholders.dev/?width=640&height=360&text=Instagram+Reel&bgColor=%231a1a2e&textColor=%23ffffff`;
            }
        }

        // Handle Dropbox URLs in thumbnails (often found in avatar_video types)
        if (thumbnail && (thumbnail.includes('dropbox.com') || thumbnail.includes('db.tt'))) {
            thumbnail = convertDropboxUrl(thumbnail);
        }

        const videoData = {
            title: video.title && video.title !== '(title not found)' ? video.title : '',
            thumbnail: thumbnail || `https://images.placeholders.dev/?width=640&height=360&text=No%20Image&bgColor=%230a0a0a&textColor=%23ffffff`,
            views: video.views || 0,
            median_views: video.median_views || 0,
            multiplier: parseFloat(video.multiplier) || 1.1,
            video_url: video.video_url,
            embed_url: embedUrl,
            date_posted: video.published_at || video.posted_at || new Date().toISOString(),
            creator: video.username || video.creator_username || 'Creator',
            platform: video.platform || platform,
            video_id: videoId,
            creator_platform: video.creator_platform,
            primary_sub_niche: video.primary_sub_niche,
            secondary_sub_niche: video.secondary_sub_niche
        };

        // Add computed fields
        videoData.duration = getDuration({ ...video, video_id: videoId });
        videoData.relative_time = getRelativeTime(videoData.date_posted);
        videoData.subscribers = video.subscribers || 0;

        return videoData;
    });

    let finalOutliers = [...outliers];

    // DEV ONLY: Duplicate data to fill the grid for UI testing
    if (isLocal && finalOutliers.length > 0) {
        const original = [...finalOutliers];
        for (let i = 0; i < 50; i++) {
            const batch = original.map((o, idx) => ({ ...o, video_id: `${o.video_id}_demo_${i}_${idx}` }));
            finalOutliers = finalOutliers.concat(batch);
        }
    }

    return {
        platform,
        outliers: finalOutliers,
    };
}

/**
 * Fetches outlier videos from Supabase view
 * @param {string} platform - 'facebook' | 'youtube' | 'instagram'
 * @returns {Promise<{platform: string, outliers: Array}>}
 */
/**
 * Fetches user niches from creator_profiles
 * @param {string} uniqueId 
 * @returns {Promise<{primary: string, secondary: string}>}
 */
/**
 * Fetches user profile and niches from creator_profiles
 * Supports both unique_identifier and numeric platform IDs
 * @param {string} searchId 
 * @param {boolean} isNumeric - If true, searches for unique_identifier ending with searchId
 * @returns {Promise<Object>} Full profile object
 */
export async function fetchUserNiches(searchId, isNumeric = false) {
    try {
        console.log(`[API] Fetching profile for ID: ${searchId} (isNumeric: ${isNumeric})`);

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

        // Construct query: exact match or partial match for numeric IDs
        const queryTerm = isNumeric ? `ilike.%${searchId}` : `eq.${searchId}`;
        const url = `${SUPABASE_URL}/rest/v1/creator_profiles?unique_identifier=${queryTerm}&select=*`;

        const res = await fetch(url, {
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            console.error('[API] creator_profiles fetch failed:', res.status, await res.text());
            return null;
        }

        const data = await res.json();

        if (!data || data.length === 0) {
            console.warn('[API] No profile found for ID:', searchId);
            return null;
        }

        const profile = data[0];
        console.log('[API] Profile found:', profile);

        // Return structured data plus the raw profile
        return {
            main: profile.Niche,
            primaryId: profile['primary sub niche id'],
            secondaryId: profile['secondary sub niche id'],
            platform: profile.platform,
            unique_identifier: profile.unique_identifier,
            raw: profile
        };
    } catch (err) {
        console.error('Fetch niches error:', err);
        return null;
    }
}

/**
 * NEW SSO FLOW: Fetches profile based on Supabase Auth UUID (user_id)
 * @param {string} authUuid - The Supabase auth index
 * @returns {Promise<Object>} Full profile object
 */
export async function fetchProfileByAuthId(authUuid) {
    try {
        console.log(`[SSO] Looking up clone for Auth UUID: ${authUuid}`);
        const { data, error } = await supabase
            .from('creator_profiles')
            .select('*')
            .eq('user_id', authUuid)
            .maybeSingle();

        if (error) {
            console.error('[SSO] Error fetching profile by UUID:', error);
            return null;
        }

        if (!data) {
            console.log('[SSO] No clone found for this Auth UUID.');
            return null;
        }

        console.log('[SSO] Clone located:', data.unique_identifier);

        return {
            main: data.Niche,
            primaryId: data['primary sub niche id'],
            secondaryId: data['secondary sub niche id'],
            platform: data.platform,
            unique_identifier: data.unique_identifier,
            raw: data
        };
    } catch (err) {
        console.error('[SSO] Fetch profile exception:', err);
        return null;
    }
}

/**
 * Fetches outlier videos from Supabase view with niche filtering
 * @param {string} platform - 'facebook' | 'youtube' | 'instagram'
 * @param {Object} niches - { primary: string, secondary: string }
 * @returns {Promise<{platform: string, outliers: Array}>}
 */
export async function fetchOutliers(platform, niches = null) {
    if (!platform) {
        throw new Error('Platform is required');
    }

    try {
        console.log(`Fetching outliers for platform: ${platform}, niches:`, niches);

        const ORDER_COL = 'published_at'; // Defaulting to the column we know exists

        // Level 1: Try specific Sub-Niche Pair + LLM VALIDATED
        let query = supabase.from(VIEW_NAME)
            .select('*')
            .eq('platform', platform)
            .eq('llm_validated', true);

        if (niches) {
            const pId = niches.primaryId;
            const sId = niches.secondaryId;
            const nId = niches.mainId || (niches.raw && niches.raw.niche_id);

            if (pId && pId !== 'None' && pId !== 'null') query = query.eq('primary_sub_niche_id', pId);
            if (sId && sId !== 'None' && sId !== 'null') query = query.eq('secondary_sub_niche_id', sId);
            if (nId && nId !== 'None' && nId !== 'null') query = query.eq('niche_id', nId);
        }

        let { data: rawData, error } = await query.order(ORDER_COL, { ascending: false }).limit(100);

        // Level 2: Fallback to Main Niche if Sub-Niche pair is empty
        if ((!rawData || rawData.length === 0) && niches && (niches.mainId || niches.raw?.niche_id)) {
            console.log('[API] No sub-niche matches, falling back to main niche...');
            const nId = niches.mainId || niches.raw.niche_id;
            const fallbackQuery = supabase
                .from(VIEW_NAME)
                .select('*')
                .eq('platform', platform)
                .eq('niche_id', nId)
                .eq('llm_validated', true)
                .limit(100);

            const { data: nicheData, error: nicheError } = await fallbackQuery.order(ORDER_COL, { ascending: false });
            if (!nicheError) rawData = nicheData;
        }

        // Level 3: Fallback to All Validated for Platform if still empty
        if (!rawData || rawData.length === 0) {
            console.log('[API] No niche matches, falling back to all validated platform videos...');
            const allQuery = supabase
                .from(VIEW_NAME)
                .select('*')
                .eq('platform', platform)
                .eq('llm_validated', true)
                .limit(50);

            const { data: allData, error: allError } = await allQuery.order(ORDER_COL, { ascending: false });
            if (!allError) rawData = allData;
        }

        if (error && !rawData) {
            console.error('Supabase query error:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        // DEDUPLICATION LOGIC
        const seenIds = new Set();
        let finalData = (rawData || []).filter(video => {
            if (!video.id) return true;
            if (seenIds.has(video.id)) return false;
            seenIds.add(video.id);
            return true;
        });

        console.log(`[API] Found ${rawData?.length || 0} rows, showing ${finalData.length} unique videos.`);

        // Fallback: fetch latest 3 videos if no results found
        if (finalData.length === 0) {
            console.log('No outliers found, attempting fallback to videos table...');
            try {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('videos')
                    .select('*')
                    .order('posted_at', { ascending: false })
                    .limit(3);

                if (!fallbackError && fallbackData?.length > 0) {
                    console.log(`Fallback successful: Retrieved ${fallbackData.length} videos`);
                    // Inject fake stats for demo purposes so they pass the filters (min 1k views, min 1x multiplier)
                    finalData = fallbackData.map(v => ({
                        ...v,
                        views: v.views && v.views > 1000 ? v.views : 2500,
                        multiplier: v.multiplier || 2.5
                    }));
                } else {
                    if (fallbackError) console.warn('Fallback fetch failed:', fallbackError);

                    // SECONDARY FALLBACK: videos_niche_map
                    console.log('Videos table empty/failed, attempting fallback to videos_niche_map...');
                    const { data: mapData, error: mapError } = await supabase
                        .from('videos_niche_map')
                        .select('*')
                        .limit(5);

                    if (!mapError && mapData?.length > 0) {
                        console.log(`Map Fallback successful: Retrieved ${mapData.length} entries`);
                        finalData = mapData.map(v => {
                            // Try to deduce thumbnail from platform ID
                            let thumb = null;
                            if (v.platform === 'youtube' && v.platform_video_id) {
                                thumb = `https://img.youtube.com/vi/${v.platform_video_id}/mqdefault.jpg`;
                            }

                            return {
                                video_id: v.platform_video_id || v.id,
                                video_url: v.video_url,
                                platform: v.platform || platform,
                                title: 'Demo Video (Map fallback)',
                                creator_username: 'Demo User',
                                views: 5000,
                                multiplier: 5.0,
                                posted_at: v.created_at || new Date().toISOString(),
                                thumbnail_url: thumb,
                                description: 'Recovered from niche map'
                            };
                        });
                    } else if (mapError) {
                        console.warn('Map Fallback failed:', mapError);
                    }
                }
            } catch (err) {
                console.warn('Fallback error:', err);
            }
        }

        // --- REAL DATA FALLBACK FOR LOCALHOST UI TESTING ---
        // If we found nothing but are on localhost, pull ANY real videos from the 'videos' table 
        if (finalData.length === 0 && isLocal) {
            console.log('[API] Localhost detected & empty results. Pulling discovery sample from "videos" table...');
            const { data: discoveryData, error: discoveryError } = await supabase
                .from('videos')
                .select('*')
                .eq('platform', platform)
                .order('posted_at', { ascending: false })
                .limit(40);

            if (!discoveryError && discoveryData?.length > 0) {
                finalData = discoveryData.map(v => ({
                    ...v,
                    id: v.id,
                    username: v.creator_username || 'Test Creator',
                    published_at: v.posted_at || new Date().toISOString(),
                    multiplier: v.multiplier || (1.1 + Math.random() * 2), // Fake a multiplier if missing for UI testing
                    views: v.views || Math.floor(Math.random() * 50000)
                }));
            }
        }

        const transformedData = transformSupabaseResponse(finalData, platform);
        return transformedData;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}
/**
 * Triggers an n8n webhook for a specific action (script, thumbnail, title)
 * @param {string} action - 'script' | 'thumbnail' | 'title'
 * @param {Object} video - Video object data
 * @returns {Promise<Response>}
 */
export async function triggerN8nWebhook(action, video, uniqueId) {
    const PRODUCTION_WEBHOOK = 'http://localhost:5678/webhook/243c0744-0e0b-45eb-b2b9-149fe9e3a0f4';
    const AVATAR_VIDEO_WEBHOOK = 'https://n8n.srv1046180.hstgr.cloud/webhook/5033f616-91d2-4f22-8cb0-cd0a379816a4';

    const TARGET_URL = action === 'avatar_video' ? AVATAR_VIDEO_WEBHOOK : PRODUCTION_WEBHOOK;

    // Use our own backend as a proxy to bypass CORS
    // If we're on localhost, we might need the full URL, but in production /proxy/webhook is enough
    const isLocal = window.location.hostname === 'localhost';
    const PROXY_BASE = isLocal ? 'http://localhost:3005' : '/ideas';
    const WEBHOOK_URL = `${PROXY_BASE}/proxy/webhook?target=${encodeURIComponent(TARGET_URL)}`;

    try {
        if (!uniqueId) {
            console.error('[Webhook Warning] No uniqueId provided. n8n might fail to associate this with a user.');
        }

        console.log(`Triggering proxy webhook for ${action}:`, video.title, 'User:', uniqueId);
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clicked_item: action,
                unique_identifier: uniqueId || 'unknown_user',
                video: {
                    id: video.video_id,
                    title: video.title,
                    url: video.video_url,
                    creator: video.creator,
                    platform: video.platform,
                    multiplier: video.multiplier,
                    views: video.views,
                    thumbnail: video.thumbnail
                },
                timestamp: new Date().toISOString()
            }),
        });

        if (!response.ok) {
            throw new Error(`Webhook failed: ${response.statusText}`);
        }

        console.log('Webhook triggered successfully');
        return response;
    } catch (error) {
        console.error('Webhook error:', error);
        throw error;
    }
}
/**
 * Fetches generated items from Supabase with user filtering
 * @param {string} type - 'script' | 'title' | 'thumbnail'
 * @param {string} uniqueId - The person's ID to filter by
 * @returns {Promise<Array>}
 */
export async function fetchGeneratedItems(type, uniqueId = null) {
    try {
        console.log(`Fetching generated items for type: ${type}${uniqueId ? ' for user ' + uniqueId : ''}`);
        let query = supabase
            .from('assets')
            .select('id, unique_identifier, video_id, asset_type, asset_value, created_at')
            .eq('asset_type', type);

        if (uniqueId) {
            query = query.eq('unique_identifier', uniqueId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase query error:', error);
            return [];
        }

        // Map internal names to UI names for cleaner logic
        return (data || []).map(item => ({
            id: item.id,
            unique_id: item.unique_identifier,
            video_id: item.video_id,
            type: item.asset_type,
            content: item.asset_value,
            created_at: item.created_at
        }));
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

/**
 * Fetches all generated items with optional user filtering
 * @param {string} uniqueId 
 * @returns {Promise<Array>}
 */
export async function fetchAllGenerated(uniqueId = null) {
    try {
        let query = supabaseService
            .from('assets')
            .select('video_id, asset_type, asset_value, id, created_at, unique_identifier');

        if (uniqueId) {
            query = query.eq('unique_identifier', uniqueId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching assets:', error);
            return [];
        }

        return (data || []).map(item => ({
            video_id: item.video_id,
            type: item.asset_type,
            content: item.asset_value,
            id: item.id,
            created_at: item.created_at,
            unique_id: item.unique_identifier
        }));
    } catch (err) {
        console.error('Fetch all generated error:', err);
        return [];
    }
}

/**
 * Fetches a chronological activity feed for the notifications panel.
 * Sources: assets table (all types) + creator_profiles (avatar video).
 * @param {string} uniqueId
 * @returns {Promise<Array>} sorted newest-first
 */
export async function fetchNotifications(uniqueId) {
    if (!uniqueId) return [];
    try {
        const typeConfig = {
            title: { label: 'Title Generated', emoji: '✍️', view: 'title' },
            script: { label: 'Script Idea Generated', emoji: '📝', view: 'idea' },
            thumbnail: { label: 'Thumbnail Generated', emoji: '🖼️', view: 'thumbnail' },
            avatar_video: { label: 'Avatar Video Ready', emoji: '🎬', view: 'avatar_video' },
            bookmark: { label: 'Video Bookmarked', emoji: '🔖', view: 'bookmarks' },
        };

        // 1. All asset rows for this user
        const { data: assetRows, error: assetErr } = await supabaseService
            .from('assets')
            .select('id, asset_type, asset_value, created_at')
            .eq('unique_identifier', uniqueId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (assetErr) console.error('[Notifs] asset fetch error:', assetErr);

        const notifications = (assetRows || []).map(row => {
            const cfg = typeConfig[row.asset_type] || { label: row.asset_type, emoji: '⚡', view: 'home' };
            let detail = '';
            if (row.asset_type === 'bookmark') {
                try { detail = JSON.parse(row.asset_value)?.title || ''; } catch { detail = ''; }
            } else {
                detail = String(row.asset_value || '').replace(/['"]/g, '').slice(0, 72);
            }
            return {
                id: row.id,
                type: row.asset_type,
                emoji: cfg.emoji,
                label: cfg.label,
                detail,
                view: cfg.view,
                created_at: row.created_at,
            };
        });

        // 2. Avatar video from creator_profiles (if URL set, treat as a notification)
        const { data: profileRow } = await supabase
            .from('creator_profiles')
            .select('heygen_video_db_url, updated_at, created_at')
            .eq('unique_identifier', uniqueId)
            .maybeSingle();

        if (profileRow?.heygen_video_db_url) {
            notifications.push({
                id: 'avatar_profile',
                type: 'avatar_video',
                emoji: '🎬',
                label: 'Avatar Video Ready',
                detail: 'Your AI avatar video has been generated.',
                view: 'avatar_video',
                created_at: profileRow.updated_at || profileRow.created_at,
            });
        }

        // Sort newest first, deduplicate by id
        const seen = new Set();
        return notifications
            .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    } catch (err) {
        console.error('[Notifs] fetch error:', err);
        return [];
    }
}

/**
 * Saves a video as a bookmark
 * @param {Object} video - The video object to bookmark
 * @param {string} uniqueId - The user's unique identifier
 */
export async function saveBookmark(video, uniqueId) {
    if (!uniqueId) {
        console.error('Cannot bookmark: missing uniqueId');
        return null;
    }

    try {
        const { data, error } = await supabaseService
            .from('assets')
            .insert({
                unique_identifier: uniqueId,
                video_id: video.video_id || video.id, // Handle cases where ID might be in different props
                asset_type: 'bookmark',
                asset_value: JSON.stringify(video) // Store the whole video object
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error saving bookmark:', err);
        throw err;
    }
}

/**
 * Removes a bookmark
 * @param {string} videoId 
 * @param {string} uniqueId 
 */
export async function deleteBookmark(videoId, uniqueId) {
    if (!uniqueId) return;

    try {
        const { error } = await supabaseService
            .from('assets')
            .delete()
            .eq('unique_identifier', uniqueId)
            .eq('video_id', videoId)
            .eq('asset_type', 'bookmark');

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error deleting bookmark:', err);
        throw err;
    }
}

/**
 * Fetches user bookmarks, parsing the stored video JSON
 * @param {string} uniqueId 
 * @returns {Promise<Array>} List of video objects
 */
export async function fetchBookmarks(uniqueId) {
    if (!uniqueId) return [];

    try {
        const { data, error } = await supabaseService
            .from('assets')
            .select('asset_value, created_at')
            .eq('unique_identifier', uniqueId)
            .eq('asset_type', 'bookmark')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(item => {
            try {
                const video = JSON.parse(item.asset_value);
                // Ensure the video object has the timestamp of bookmarking if needed, 
                // or just return the video as is.
                return { ...video, bookmarked_at: item.created_at };
            } catch (e) {
                console.error('Failed to parse bookmark:', e);
                return null;
            }
        }).filter(Boolean);
    } catch (err) {
        console.error('Error fetching bookmarks:', err);
        return [];
    }
}

/**
 * Fetches multiple videos by their IDs
 * @param {Array<string>} videoIds 
 * @returns {Promise<Array>}
 */
export async function fetchVideosByIds(videoIds) {
    if (!videoIds || videoIds.length === 0) return [];

    try {
        console.log(`[API] Fetching ${videoIds.length} source videos from base table...`);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = videoIds.filter(id => uuidPattern.test(id));
        // Non-UUID IDs are platform IDs (e.g. YouTube video IDs, Instagram shortcodes)
        const platformIds = videoIds.filter(id => !uuidPattern.test(id));

        // Build OR filter: match by `platform_video_id` (the actual column name) OR by UUID `id`
        const filters = [];
        if (platformIds.length > 0) {
            filters.push(`platform_video_id.in.(${platformIds.map(id => `"${id}"`).join(',')})`);
        }
        if (validUuids.length > 0) {
            filters.push(`id.in.(${validUuids.map(id => `"${id}"`).join(',')})`);
        }
        const orFilter = filters.join(',');

        if (!orFilter) {
            console.warn('[API] fetchVideosByIds: no valid filters built, returning empty');
            return [];
        }

        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .or(orFilter);

        if (error) {
            console.error('Error fetching videos:', error);
            return [];
        }

        // Transform each video manually (avoid the localhost 50x duplication in transformSupabaseResponse)
        const rawVideos = data || [];
        console.log(`[API] fetchVideosByIds: got ${rawVideos.length} rows from DB`);
        return rawVideos.map(video => {
            // `platform_video_id` is the actual column (e.g. YouTube ID, Instagram shortcode)
            // `id` is the DB UUID primary key
            const platformVid = video.platform_video_id || '';
            const videoId = platformVid || video.id || Math.random().toString(36).substring(7);

            let embedUrl = null;
            let thumbnail = video.thumbnail_url;

            if (video.platform === 'youtube' && video.video_url) {
                const yid = video.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\n?#]+)/)?.[1];
                if (yid) embedUrl = `https://www.youtube.com/embed/${yid}`;
            } else if (video.platform === 'instagram' && video.video_url) {
                const shortcode = video.video_url.match(/(?:instagram\.com\/(?:p|reel|reels)\/)([^/?#&]+)/)?.[1];
                if (shortcode) {
                    embedUrl = `https://www.instagram.com/p/${shortcode}/embed`;
                    thumbnail = video.thumbnail_url || `https://images.placeholders.dev/?width=640&height=360&text=Instagram+Reel&bgColor=%231a1a2e&textColor=%23ffffff`;
                }
            }

            if (thumbnail && (thumbnail.includes('dropbox.com') || thumbnail.includes('db.tt'))) {
                thumbnail = thumbnail.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
            }

            return {
                // Expose all three ID representations so HomeScreen matching is robust
                _rawId: video.id,              // DB UUID primary key
                id: video.id,                  // Same as above, for v.id matching
                video_id: videoId,             // Platform video ID (what n8n stores in assets.video_id)
                _platformId: platformVid,      // Explicit platform ID alias
                title: video.title && video.title !== '(title not found)' ? video.title : '',
                thumbnail: thumbnail || `https://images.placeholders.dev/?width=640&height=360&text=No%20Image&bgColor=%230a0a0a&textColor=%23ffffff`,
                views: video.views || 0,
                video_url: video.video_url,
                embed_url: embedUrl,
                creator: (() => {
                    // Try DB columns first
                    if (video.creator_username) return video.creator_username;
                    if (video.username) return video.username;
                    // Fallback: extract from URL
                    const url = video.video_url || '';
                    // Instagram: instagram.com/@handle/reel/... or instagram.com/handle/
                    const igHandle = url.match(/instagram\.com\/@?([^/?\s]+)\//)?.[1];
                    if (igHandle && !['p', 'reel', 'reels', 'stories'].includes(igHandle)) return igHandle;
                    // YouTube: /@handle, /c/name, /user/name
                    const ytHandle = url.match(/youtube\.com\/(?:@|c\/|user\/)([^/?\s&]+)/)?.[1];
                    if (ytHandle) return ytHandle;
                    return 'Creator';
                })(),
                platform: video.platform,
            };
        });
    } catch (err) {
        console.error('Fetch videos by IDs error:', err);
        return [];
    }
}

/**
 * Fetches avatar videos generated for a specific user from creator_profiles
 * @param {string} uniqueId - User's unique identifier
 * @returns {Promise<Array>}
 */
export async function fetchAvatarVideos(uniqueId) {
    if (!uniqueId) return [];

    try {
        console.log('[API] Fetching avatar videos for ID:', uniqueId);
        const { data, error } = await supabase
            .from('creator_profiles')
            .select('heygen_video_db_url, heygen_thumbnail_db_url, id, unique_identifier')
            .eq('unique_identifier', uniqueId);

        if (error) {
            console.error('Error fetching avatar videos:', error);
            return [];
        }

        // Filter out entries without video URLs and transform to match asset format
        return (data || [])
            .filter(item => item.heygen_video_db_url)
            .map(item => ({
                id: item.id,
                type: 'avatar_video',
                video_url: convertDropboxUrl(item.heygen_video_db_url),
                thumbnail_url: convertDropboxUrl(item.heygen_thumbnail_db_url),
                unique_id: item.unique_identifier,
                created_at: null // creator_profiles doesn't have timestamp for videos
            }));
    } catch (err) {
        console.error('Fetch avatar videos error:', err);
        return [];
    }
}

/**
 * Polls creator_profiles to check if an avatar video has been generated.
 * Returns the heygen_video_db_url string if ready, null if not yet available.
 * @param {string} uniqueId - The user's unique identifier
 * @returns {Promise<string|null>}
 */
export async function pollForAvatarVideo(uniqueId) {
    if (!uniqueId) return null;
    try {
        const { data, error } = await supabase
            .from('creator_profiles')
            .select('heygen_video_db_url, heygen_thumbnail_db_url')
            .eq('unique_identifier', uniqueId)
            .maybeSingle();

        if (error) {
            console.error('[Poll] Error checking for avatar video:', error);
            return null;
        }

        const url = data?.heygen_video_db_url;
        console.log('[Poll] heygen_video_db_url:', url || '(empty)');
        return url || null;
    } catch (err) {
        console.error('[Poll] Exception:', err);
        return null;
    }
}

/**
 * Converts Dropbox preview URLs to direct download URLs
 * @param {string} url - Dropbox URL
 * @returns {string} - Direct download URL
 */
function convertDropboxUrl(url) {
    if (!url) return url;

    // Convert Dropbox preview links to direct download
    if (url.includes('dropbox.com')) {
        // Replace dl=0 with raw=1 for direct access
        return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
    }

    return url;
}
