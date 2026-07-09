import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  PlayCircle, 
  LayoutDashboard, 
  Save, 
  Check, 
  Hash, 
  AlertCircle, 
  Cloud, 
  LogIn, 
  Tag, 
  Plus, 
  ExternalLink, 
  Sparkles, 
  Clock, 
  Film, 
  Timer,
  Sun,
  Moon,
  Monitor,
  TrendingUp,
  ShieldCheck,
  Zap,
  Leaf
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner, Skeleton } from '../components/ui/Loading';
import { useTheme, ThemeToggle } from '../shared/theme.js';
import {
  initStorage,
  getGameState,
  getQueue,
  addToQueue,
  updateQueueItem,
  subscribe,
  getSavedVideos,
  ensureChannelSaved,
} from '../shared/storage.js';
import { 
  isChannelUrl, 
  extractChannelId, 
  extractYouTubeVideoId, 
  STORAGE_KEYS,
  getPlantStatus,
  PLANT_THRESHOLDS
} from '../shared/constants.js';
import { validateUrl, validateQueueItem } from '../shared/validation.js';
import { getCurrentUser, signInWithGoogle, signOut, isLoggedIn, getUserEmail, getUserName, getPersistedAuthState } from '../shared/auth.js';
import { supabaseClient } from '../shared/supabase.js';
import { syncWithCloud } from '../shared/sync.js';
import { useToast } from '../components/ui/Toast';

// Pages where saving makes sense as a proper video/reel item.
function isVideoPage(url) {
  if (!url) return false;
  return (
    /youtube\.com\/(watch|shorts)/i.test(url) ||
    /instagram\.com\/(reel|reels|p)\//i.test(url) ||
    /tiktok\.com\/@.+\/video\//i.test(url) ||
    /twitter\.com\/.*\/status\//i.test(url) ||
    /x\.com\/.*\/status\//i.test(url)
  );
}

// Premium plant status styling
const PLANT_STATUS = {
  thriving: {
    emoji: '🌿',
    label: 'Thriving',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.4))',
    progress: 100,
  },
  okay: {
    emoji: '🌱',
    label: 'Okay',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.4))',
    progress: 60,
  },
  wilting: {
    emoji: '🌵',
    label: 'Wilting',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    glow: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.4))',
    progress: 30,
  },
  dead: {
    emoji: '🪴',
    label: 'Dead',
    color: 'text-gray-400',
    bg: 'bg-gray-800/10',
    border: 'border-gray-700/20',
    glow: 'grayscale(100%)',
    progress: 0,
  },
};

// Calculate plant status from budget
function calculatePlantStatus(budgetUsed, budgetTotal) {
  if (budgetTotal <= 0) return 'dead';
  const remaining = budgetTotal - budgetUsed;
  const pct = remaining / budgetTotal;
  
  if (pct >= PLANT_THRESHOLDS.THRIVING) return 'thriving';
  if (pct >= PLANT_THRESHOLDS.OKAY) return 'okay';
  if (pct > 0) return 'wilting';
  return 'dead';
}

// Format time display
function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Main Popup Component
function PopupApp() {
  const { isDark } = useTheme();
  const { success, error: showError, warning } = useToast();
  const [ready, setReady] = useState(false);
  const [pageInfo, setPageInfo] = useState(null);
  const [game, setGame] = useState({ 
    plant: 'thriving', 
    budgetMinutesTotal: 60, 
    budgetMinutesUsed: 0 
  });
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [tabError, setTabError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        await initStorage();
        const gameState = getGameState();
        setGame(gameState);
        
        // Check auth
        const user = await getCurrentUser();
        setUser(user);
        
        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.url) {
          const url = tab.url;
          const title = tab.title || 'Current Page';
          const favIconUrl = tab.favIconUrl || '';
          
          // Check if already saved
          const queue = getQueue();
          const vid = extractYouTubeVideoId(url);
          const isSaved = queue.some((i) => {
            if (i.deleted) return false;
            if (i.url === url) return true;
            if (vid && extractYouTubeVideoId(i.url) === vid) return true;
            return false;
          });
          
          setPageInfo({ url, title, favIconUrl });
          setAlreadySaved(isSaved);
        }
        
        setReady(true);
      } catch (err) {
        console.error('Popup init error:', err);
        setTabError('Failed to initialize. Please refresh.');
      }
    }
    
    init();
    
    // Subscribe to storage changes
    const unsubscribe = subscribe(STORAGE_KEYS.GAME, (newGame) => {
      setGame(newGame);
    });
    
    return () => unsubscribe?.();
  }, []);

  // Calculate plant status
  const plantStatus = useMemo(() => {
    return calculatePlantStatus(game.budgetMinutesUsed, game.budgetMinutesTotal);
  }, [game.budgetMinutesUsed, game.budgetMinutesTotal]);

  const plantConfig = PLANT_STATUS[plantStatus] || PLANT_STATUS.thriving;
  const remainingMinutes = Math.max(0, game.budgetMinutesTotal - game.budgetMinutesUsed);
  const progressPercent = Math.min(100, (remainingMinutes / game.budgetMinutesTotal) * 100);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!pageInfo || !pageInfo.url) {
      showError('No page to save');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Validate URL
      const validatedUrl = validateUrl(pageInfo.url, { requireVideoPlatform: true });
      if (!validatedUrl) {
        showError('Please navigate to a supported video page');
        setIsSaving(false);
        return;
      }
      
      // Check if already saved
      if (alreadySaved) {
        warning('This video is already saved!');
        setIsSaving(false);
        return;
      }
      
      // Create queue item
      const videoId = extractYouTubeVideoId(validatedUrl);
      const entry = {
        id: crypto.randomUUID(),
        url: validatedUrl,
        title: pageInfo.title || 'Untitled',
        favIconUrl: pageInfo.favIconUrl || '',
        platform: 'youtube',
        contentType: isVideoPage(validatedUrl) ? 'video' : 'link',
        savedAt: Date.now(),
        updatedAt: Date.now(),
        fromContentScript: false,
      };
      
      // Validate and add
      const validatedEntry = validateQueueItem(entry);
      if (!validatedEntry) {
        showError('Invalid video data');
        setIsSaving(false);
        return;
      }
      
      await addToQueue(validatedEntry);
      setAlreadySaved(true);
      
      success('Video saved successfully! ✨');
      
      // Trigger scrape
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' });
      
    } catch (err) {
      console.error('Save error:', err);
      showError('Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [pageInfo, alreadySaved, showError, success, warning]);

  // Handle sync
  const handleSync = useCallback(async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncWithCloud();
      success('Synced successfully! ☁️');
    } catch (err) {
      console.error('Sync error:', err);
      showError('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [user, success, showError]);

  // Handle auth
  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
      const user = await getCurrentUser();
      setUser(user);
      setShowAuthModal(false);
      success('Signed in successfully! 🎉');
    } catch (err) {
      console.error('Sign in error:', err);
      showError('Sign in failed. Please try again.');
    }
  }, [success, showError]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setUser(null);
      success('Signed out successfully');
    } catch (err) {
      console.error('Sign out error:', err);
      showError('Sign out failed');
    }
  }, [success, showError]);

  // Open dashboard
  const openDashboard = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }, []);

  // If not ready, show loading
  if (!ready) {
    return (
      <div className="w-[320px] h-[400px] flex items-center justify-center bg-[var(--theme-surface)]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-[var(--theme-text-secondary)]">
            Loading DopaQueue...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] min-h-[400px] bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl shadow-glass overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[var(--theme-text-primary)]">DopaQueue</h1>
            <p className="text-xs text-[var(--theme-text-muted)]">Save intentionally</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <button 
              onClick={openDashboard}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Open Dashboard"
            >
              <LayoutDashboard className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* Plant Status Card */}
        <div className="glass-elevated rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--theme-text-secondary)]">
                Your Focus Plant
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl ${plantConfig.glow}`}>{plantConfig.emoji}</span>
                <Badge variant={plantStatus === 'thriving' ? 'success' : plantStatus === 'okay' ? 'warning' : plantStatus === 'wilting' ? 'danger' : 'default'}>
                  {plantConfig.label}
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-[var(--theme-text-muted)]">Remaining</p>
              <p className="text-lg font-semibold text-[var(--theme-text-primary)]">
                {formatTime(remainingMinutes)}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-[var(--theme-text-muted)] mt-2">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Current Page Card */}
        {pageInfo && (
          <div className="glass-elevated rounded-lg p-4">
            <div className="flex items-start gap-3">
              {pageInfo.favIconUrl && (
                <img 
                  src={pageInfo.favIconUrl} 
                  alt="" 
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--theme-text-primary)] truncate">
                  {pageInfo.title}
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] truncate">
                  {pageInfo.url}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              {alreadySaved ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  leftIcon={<Check className="w-4 h-4" />}
                  disabled
                >
                  Already Saved
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full glass-btn neon-glow"
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSave}
                  isLoading={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Video'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2"
            leftIcon={<LayoutDashboard className="w-4 h-4" />}
            onClick={openDashboard}
          >
            Dashboard
          </Button>
          
          {user ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              leftIcon={<Cloud className="w-4 h-4" />}
              onClick={handleSync}
              isLoading={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              leftIcon={<LogIn className="w-4 h-4" />}
              onClick={() => setShowAuthModal(true)}
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="glass-elevated rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--theme-text-secondary)] mb-3">
            Today's Stats
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--theme-text-primary)]">
                {getSavedVideos().length}
              </p>
              <p className="text-xs text-[var(--theme-text-muted)]">Saved</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--theme-text-primary)]">
                {formatTime(game.budgetMinutesUsed)}
              </p>
              <p className="text-xs text-[var(--theme-text-muted)]">Used</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--theme-text-primary)]">
                {formatTime(remainingMinutes)}
              </p>
              <p className="text-xs text-[var(--theme-text-muted)]">Left</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-[var(--theme-border)] text-center">
        <p className="text-xs text-[var(--theme-text-muted)]">
          v0.2.0 - Save intentionally, not impulsively
        </p>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-elevated rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--theme-text-primary)]">
                Sign In
              </h2>
              <button 
                onClick={() => setShowAuthModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5 text-[var(--theme-text-secondary)]" />
              </button>
            </div>
            
            <p className="text-sm text-[var(--theme-text-secondary)] mb-6">
              Sign in to sync your data across devices and unlock cloud features.
            </p>
            
            <Button 
              variant="primary" 
              size="md" 
              className="w-full glass-btn"
              leftIcon={<Cloud className="w-5 h-5" />}
              onClick={handleSignIn}
            >
              Continue with Google
            </Button>
            
            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {tabError && (
        <div className="fixed bottom-4 left-4 right-4 p-3 bg-red-500/10 backdrop-blur-md rounded-lg border border-red-500/20">
          <p className="text-sm text-red-500">{tabError}</p>
        </div>
      )}
    </div>
  );
}

// Wrap with theme provider
export default function App() {
  return (
    <PopupApp />
  );
}
