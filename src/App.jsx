import { useState, useEffect, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import HomeScreen from './components/HomeScreen';
import ResultsScreen from './components/ResultsScreen';
import VideoModal from './components/VideoModal';
import LoadingSpinner from './components/LoadingSpinner';
import { fetchOutliers, triggerN8nWebhook, fetchAllGenerated, fetchVideosByIds, fetchUserNiches, fetchAvatarVideos, saveBookmark, deleteBookmark, fetchBookmarks, fetchProfileByAuthId, pollForAvatarVideo } from './services/api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Banner from './components/Banner';
import ProcessingOverlay from './components/ProcessingOverlay';
import ImageModal from './components/ImageModal';
import PricingScreen from './components/PricingScreen';
import AccountScreen from './components/AccountScreen';
import NotificationsPanel from './components/NotificationsPanel';
import { supabase } from './lib/supabaseClient';
import './App.css';

function App() {
  const [screen, setScreen] = useState('home'); // 'home' | 'results' | 'error'
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [loadingText, setLoadingText] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState(null);
  const [outliers, setOutliers] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [processingState, setProcessingState] = useState({ status: 'idle', action: null, result: null });
  const [generatedContent, setGeneratedContent] = useState([]);
  const [sourceVideos, setSourceVideos] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userNiches, setUserNiches] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [avatarVideos, setAvatarVideos] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Ref to hold the avatar polling timeout so we can cancel it if the overlay is closed
  const avatarPollRef = useRef(null);

  // Apply dark/light class to body
  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  const handleToggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Fetch which videos have generated content
  const refreshGeneratedContent = async (currentUserId) => {
    // 1. Fetch from Supabase (if table exists)
    const dbData = await fetchAllGenerated(currentUserId || userId);

    // 2. Load from LocalStorage (Fallback)
    const localData = JSON.parse(localStorage.getItem('generated_content') || '[]');

    // Merge them (preferring DB data but keeping local for immediate feedback)
    const combined = [...dbData];
    localData.forEach(item => {
      if (!combined.some(db => db.video_id === item.video_id && db.type === item.type && db.content === item.content)) {
        combined.push(item);
      }
    });

    setGeneratedContent(combined);

    // Fetch corresponding source videos
    const videoIds = [...new Set(combined.map(item => item.video_id))].filter(Boolean);
    console.log('[GeneratedContent] Refreshing source videos for IDs:', videoIds);
    if (videoIds.length > 0) {
      const videos = await fetchVideosByIds(videoIds);
      console.log('[GeneratedContent] Successfully fetched source videos:', videos.length);
      setSourceVideos(videos);
    }
  };

  const refreshBookmarks = async (uid) => {
    if (!uid) return;
    const bks = await fetchBookmarks(uid);
    setBookmarks(bks);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        // 1. Check URL first (overrides session) - PRIORITY #1
        const urlParams = new URLSearchParams(window.location.search);
        let uniqueId = urlParams.get('id') || urlParams.get('unique_identifier');

        console.log('[Auth] Initializing with URL ID:', uniqueId);

        // 2. If not in URL, check localStorage (previous session)
        if (!uniqueId) {
          uniqueId = localStorage.getItem('user_id');
        }

        // 3. SSO FLOW: Read unique_identifier from Air Clone's user_metadata
        let profileData = null;
        if (!uniqueId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const metadata = session.user.user_metadata || {};
            console.log('[SSO] Auth session detected. User metadata:', metadata);

            // PRIMARY: Air Clone writes unique_identifier directly into user_metadata
            if (metadata.unique_identifier) {
              uniqueId = metadata.unique_identifier;
              console.log('[SSO] Resolved unique_identifier from user_metadata:', uniqueId);
            } else {
              // FALLBACK 1: Look up the clone profile by Auth UUID (new method)
              console.log('[SSO] unique_identifier not in metadata. Trying DB lookup by Auth UUID...');
              profileData = await fetchProfileByAuthId(session.user.id);
              if (profileData) {
                uniqueId = profileData.unique_identifier;
                console.log('[SSO] Resolved unique_identifier via Auth UUID DB lookup:', uniqueId);
              } else {
                // FALLBACK 2: Try matching by numeric platform ID in metadata
                const numericId = metadata.instagram_id || metadata.facebook_id || metadata.youtube_id;
                if (numericId) {
                  console.log('[Auth] Attempting numeric platform ID lookup:', numericId);
                  profileData = await fetchUserNiches(numericId, true);
                  if (profileData) {
                    uniqueId = profileData.unique_identifier;
                    console.log('[SSO] Resolved unique_identifier via numeric ID lookup:', uniqueId);
                  }
                }
              }
            }

            // Final fallback: use the Auth UUID itself as the ID if no clone profile found
            if (!uniqueId) {
              console.warn('[SSO] No clone found for user, falling back to Auth UUID');
              uniqueId = session.user.id;
            }
          }
        }

        if (uniqueId) {
          // Persistence
          localStorage.setItem('user_id', uniqueId);
          setUserId(uniqueId);

          // Fetch User Profile/Niches (if not already fetched during lookup)
          const result = profileData || await fetchUserNiches(uniqueId);

          if (result) {
            setUserNiches(result);
            console.log('User profile loaded:', result);

            // Ensure we use the canonical unique_identifier if the database returned one
            const canonicalId = result.unique_identifier || uniqueId;
            if (canonicalId !== uniqueId) {
              uniqueId = canonicalId;
              setUserId(uniqueId);
              localStorage.setItem('user_id', uniqueId);
            }

            // Refresh content for this user
            await refreshGeneratedContent(uniqueId);
            const avatarVids = await fetchAvatarVideos(uniqueId);
            setAvatarVideos(avatarVids);
            await refreshBookmarks(uniqueId);

            // Dynamic platform selection based on database profile or identifier prefix
            const dbPlatform = result.platform || '';
            const isInstagram = dbPlatform.startsWith('instagram') ||
              String(uniqueId).startsWith('ig') ||
              String(uniqueId).includes('instagram');
            const isYoutube = dbPlatform.startsWith('youtube') ||
              String(uniqueId).startsWith('yt') ||
              String(uniqueId).includes('youtube');

            if (isInstagram) {
              await handlePlatformSelect('instagram', result);
            } else if (isYoutube) {
              await handlePlatformSelect('youtube', result);
            } else {
              // Default fallback
              await handlePlatformSelect('instagram', result);
            }
          }
        } else {
          await refreshGeneratedContent();
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  const handlePlatformSelect = async (platform, niches = null) => {
    // 1. Give instant feedback to the user
    setCurrentPlatform(platform);
    setIsLoading(true);
    setLoadingPlatform(platform);
    setError(null);
    setOutliers([]);
    setLoadingText('Loading outliers...');

    try {
      console.log(`[Platform] Selecting ${platform}...`);
      // Use provided niches or fallback to state
      const targetNiches = niches || userNiches;
      const data = await fetchOutliers(platform, targetNiches);

      if (data && data.outliers) {
        setOutliers(data.outliers);
        console.log(`[Platform] Successfully loaded ${data.outliers.length} videos.`);
      }
    } catch (err) {
      console.error('Failed to fetch outliers:', err);
      setError(err.message || 'Failed to load data');
      // If we failed during initial load, we might want to let them go back to selection
      setScreen('error');
    } finally {
      setIsLoading(false);
      setLoadingPlatform(null);
      setLoadingText('');
    }
  };

  const handleToggleBookmark = async (video) => {
    // Demo fallback: if no userId, use 'demo_user' so the UI still works
    const effectiveUserId = userId || 'demo_user';

    if (!effectiveUserId) {
      console.warn("Cannot bookmark: No user ID");
      return;
    }

    const isBookmarked = bookmarks.some(b => b.video_id === video.video_id);

    // Optimistic update
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(b => b.video_id !== video.video_id));
      await deleteBookmark(video.video_id, effectiveUserId);
    } else {
      const newBookmark = { ...video, bookmarked_at: new Date().toISOString() };
      setBookmarks(prev => [newBookmark, ...prev]);
      await saveBookmark(video, effectiveUserId);
    }
  };

  const handleOverlayAction = async (action, video) => {
    setProcessingState({ status: 'loading', action, result: null, phase: 'sending' });

    try {
      const effectiveUserId = userId || 'demo_user';
      const response = await triggerN8nWebhook(action, video, effectiveUserId);
      await response.json(); // consume the response body

      // ── Avatar video: keep loading and poll until the DB has the URL ──
      if (action === 'avatar_video') {
        setProcessingState({ status: 'loading', action, result: null, phase: 'waiting' });

        // Cancel any previous orphaned poll
        if (avatarPollRef.current) clearTimeout(avatarPollRef.current);

        const MAX_POLLS = 60;   // 45s initial + 60×5s = max ~345s (~5 min)
        let pollCount = 0;

        const schedulePoll = (delay) => {
          avatarPollRef.current = setTimeout(async () => {
            pollCount++;
            setProcessingState({ status: 'loading', action, result: null, phase: 'polling' });

            const videoUrl = await pollForAvatarVideo(effectiveUserId);

            if (videoUrl) {
              // ✅ Video is ready — refresh and navigate
              console.log('[AvatarPoll] Video ready:', videoUrl);
              avatarPollRef.current = null;
              const avatarVids = await fetchAvatarVideos(effectiveUserId);
              setAvatarVideos(avatarVids);
              setCurrentView('avatar_video');
              setProcessingState({ status: 'idle', action: null, result: null, phase: null });
            } else if (pollCount < MAX_POLLS) {
              // Keep polling every 5 seconds
              schedulePoll(5000);
            } else {
              // ⏱ Timed out after ~5 minutes
              console.warn('[AvatarPoll] Timed out after', pollCount, 'polls');
              avatarPollRef.current = null;
              setProcessingState({ status: 'error', action, result: 'Video generation is taking longer than expected. Please check back in the Avatar Videos tab later.', phase: null });
              setTimeout(() => setProcessingState({ status: 'idle', action: null, result: null, phase: null }), 6000);
            }
          }, delay);
        };

        // Initial delay: 45 seconds before first check
        schedulePoll(45000);
        return; // Don't fall through to normal success handling
      }

      // ── Normal actions (script / title / thumbnail) ──
      const data = await Promise.resolve({});
      setProcessingState({ status: 'success', action, result: data });

      // Save to LocalStorage immediately
      if (data.output || data.message) {
        const localData = JSON.parse(localStorage.getItem('generated_content') || '[]');
        localData.push({
          video_id: video.video_id,
          type: action,
          content: data.output || data.message,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('generated_content', JSON.stringify(localData));
      }

      setTimeout(() => {
        if (action === 'script') setCurrentView('idea');
        else if (action === 'title') setCurrentView('title');
        else if (action === 'thumbnail') setCurrentView('thumbnail');
        setProcessingState({ status: 'idle', action: null, result: null, phase: null });
        refreshGeneratedContent();
      }, 3000);

    } catch (error) {
      console.error(`Failed to trigger ${action}:`, error);
      setProcessingState({ status: 'error', action, result: error.message, phase: null });
      setTimeout(() => setProcessingState({ status: 'idle', action: null, result: null, phase: null }), 3000);
    }
  };

  const handleBack = () => {
    setOutliers([]);
    setCurrentPlatform(null);
    setCurrentView('home');
    setError(null);
  };

  const handleRetry = () => {
    setScreen('home');
    setError(null);
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
  };

  const handleImageClick = (imageUrl, title) => {
    setSelectedImage({ url: imageUrl, title });
  };

  const handleCloseImageModal = () => {
    setSelectedImage(null);
  };

  const handleViewChange = (view) => {
    if (view === 'notifications') {
      setNotificationsOpen(true);
      return;
    }
    setSearchQuery(''); // clear search on view change
    setCurrentView(view);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  if (isInitializing) {
    return (
      <div className="initializing-screen">
        <LoadingSpinner />
        <p>Authenticating...</p>
      </div>
    );
  }



  return (
    <LayoutGroup>
      <div className={`sidebar-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${!currentPlatform ? 'no-sidebar' : ''}`} style={{ scrollbarGutter: 'stable' }}>
        {currentPlatform && (
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={toggleSidebar}
            currentView={currentView}
            onViewChange={handleViewChange}
            userId={userId}
            userProfile={userNiches}
            notificationsOpen={notificationsOpen}
            onOpenNotifications={() => setNotificationsOpen(true)}
            unreadNotifCount={unreadNotifCount}
          />
        )}
        {/* Notifications slide-in panel */}
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          userId={userId}
          onNavigate={handleViewChange}
          onUnreadCountChange={setUnreadNotifCount}
        />

        <div className="app">
          <Header
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {currentView === 'pricing' ? (
            <PricingScreen
              currentPlan="Basic"
              onUpgrade={(plan) => console.log('Upgrading to', plan)}
            />
          ) : currentView === 'account' ? (
            <AccountScreen
              user={{ id: userId }}
              userProfile={userNiches}
              onNavigateToPricing={() => handleViewChange('pricing')}
            />

          ) : (
            <HomeScreen
              key={currentView}
              onPlatformSelect={handlePlatformSelect}
              platform={currentPlatform}
              outliers={outliers}
              generatedContent={generatedContent}
              sourceVideos={sourceVideos}
              avatarVideos={avatarVideos}
              bookmarks={bookmarks}
              onVideoClick={handleVideoClick}
              isLoading={isLoading}
              loadingPlatform={loadingPlatform}
              loadingText={loadingText}
              currentView={currentView}
              onAction={handleOverlayAction}
              onViewChange={handleViewChange}
              onImageClick={handleImageClick}
              onToggleBookmark={handleToggleBookmark}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {/* ... (rest of modals) ... */}

          {processingState.status !== 'idle' && (
            <ProcessingOverlay
              state={processingState}
              onClose={() => {
                // Cancel avatar video polling if active
                if (avatarPollRef.current) {
                  clearTimeout(avatarPollRef.current);
                  avatarPollRef.current = null;
                }
                setProcessingState({ status: 'idle', action: null, result: null, phase: null });
              }}
            />
          )}

          {screen === 'error' && (
            <div className="error-screen">
              <div className="error-content">
                <div className="error-icon">⚠️</div>
                <h2>Connection Error</h2>
                <p>{error || 'Failed to connect to database'}</p>
                <div className="error-instructions">
                  <p className="error-hint">
                    Please check your Supabase configuration and try again.
                  </p>
                </div>
                <button className="retry-button" onClick={handleRetry}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {selectedVideo && (
            <VideoModal
              video={selectedVideo}
              onClose={handleCloseModal}
            />
          )}

          {selectedImage && (
            <ImageModal
              imageUrl={selectedImage.url}
              title={selectedImage.title}
              onClose={handleCloseImageModal}
            />
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}

export default App;
