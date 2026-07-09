import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Leaf,
  X,
  Settings as SettingsIcon,
  Trash2,
  Download,
  Search,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Spinner, Skeleton } from '../components/ui/Loading';
import { useTheme, ThemeToggle } from '../shared/theme.js';
import { useToast } from '../components/ui/Toast';
import { OnboardingProvider } from '../shared/onboarding.js';

import {
  initStorage, 
  getSavedVideos, 
  getSavedChannels, 
  subscribe,
  removeFromQueue, 
  updateQueueItem, 
  getScrapeResult,
  getWhitelist, 
  saveWhitelist, 
  isWhitelistedChannel
} from '../shared/storage.js';

import { 
  syncWithCloud 
} from '../shared/sync.js';

import { 
  getCurrentUser, 
  signInWithGoogle, 
  signOut 
} from '../shared/auth.js';

import {
  exportToMarkdown, 
  exportToCSV, 
  exportToJSON,
  downloadFile, 
  buildExportFilename
} from '../shared/export.js';

import {
  categorizeContent,
  extractPlatform,
  extractTags,
  getAnalysisSummary,
  getContentStats,
  getPlatformAnalysis
} from '../shared/analysis.js';

import {
  hasFeature,
  getLicenseTier,
  getLicenseInfo
} from '../shared/licensing.js';

import {
  getPlantStatus,
  STORAGE_KEYS
} from '../shared/constants.js';

import { validateUrl } from '../shared/validation.js';

// Format helpers
function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDate(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeAgo(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function getThumbnail(video) {
  if (video.thumbnail) return video.thumbnail;
  if (video.url) {
    const videoId = video.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i)?.[1];
    if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  return null;
}

// Main Dashboard Component
function DashboardApp() {
  const { isDark } = useTheme();
  const { success, error: showError } = useToast();
  const [ready, setReady] = useState(false);
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('recent');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [whitelist, setWhitelist] = useState([]);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [analysisSummary, setAnalysisSummary] = useState(null);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        await initStorage();
        const videos = getSavedVideos();
        const whitelist = getWhitelist();
        const user = await getCurrentUser();
        const licenseInfo = getLicenseInfo();
        const analysisSummary = getAnalysisSummary();
        
        setVideos(videos);
        setWhitelist(whitelist);
        setUser(user);
        setLicenseInfo(licenseInfo);
        setAnalysisSummary(analysisSummary);
        setReady(true);
      } catch (err) {
        console.error('Dashboard init error:', err);
        showError('Failed to load dashboard');
      }
    }
    init();
    
    const unsubscribeQueue = subscribe(STORAGE_KEYS.QUEUE, () => {
      setVideos(getSavedVideos());
      setAnalysisSummary(getAnalysisSummary());
    });
    
    const unsubscribeSettings = subscribe(STORAGE_KEYS.SETTINGS, () => {
      setWhitelist(getWhitelist());
    });
    
    return () => {
      unsubscribeQueue?.();
      unsubscribeSettings?.();
    };
  }, [showError]);

  // Filter and sort videos
  const filteredVideos = useMemo(() => {
    let result = [...videos];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(video => 
        (video.title || '').toLowerCase().includes(query) ||
        (video.channel || '').toLowerCase().includes(query) ||
        (video.url || '').toLowerCase().includes(query) ||
        (video.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title': return sortDirection === 'asc' ? (a.title || '').localeCompare(b.title || '') : (b.title || '').localeCompare(a.title || '');
        case 'platform': return sortDirection === 'asc' ? extractPlatform(a.url).localeCompare(extractPlatform(b.url)) : extractPlatform(b.url).localeCompare(extractPlatform(a.url));
        case 'category': return sortDirection === 'asc' ? categorizeContent(a).localeCompare(categorizeContent(b)) : categorizeContent(b).localeCompare(categorizeContent(a));
        case 'recent':
        default: return sortDirection === 'asc' ? new Date(a.savedAt) - new Date(b.savedAt) : new Date(b.savedAt) - new Date(a.savedAt);
      }
    });
    return result;
  }, [videos, searchQuery, sortBy, sortDirection]);

  // Stats
  const categories = useMemo(() => {
    const unique = new Set();
    videos.forEach(video => unique.add(categorizeContent(video)));
    return ['all', ...Array.from(unique)];
  }, [videos]);

  const platforms = useMemo(() => {
    const unique = new Set();
    videos.forEach(video => unique.add(extractPlatform(video.url)));
    return ['all', ...Array.from(unique)];
  }, [videos]);

  const contentStats = useMemo(() => getContentStats(filteredVideos), [filteredVideos]);

  // Handlers
  const handleSync = useCallback(async () => {
    if (!user) { showError('Please sign in'); return; }
    setIsSyncing(true);
    try {
      await syncWithCloud();
      success('Synced successfully!');
    } catch (err) {
      showError('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [user, success, showError]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
      setUser(await getCurrentUser());
      success('Signed in!');
    } catch (err) {
      showError('Sign in failed');
    }
  }, [success, showError]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setUser(null);
      success('Signed out');
    } catch (err) {
      showError('Sign out failed');
    }
  }, [success, showError]);

  const handleDelete = useCallback(async (id) => {
    try {
      await removeFromQueue(id);
      success('Video removed');
    } catch (err) {
      showError('Failed to remove');
    }
  }, [success, showError]);

  const handleExport = useCallback(async (format) => {
    try {
      let data, filename, mimeType;
      switch (format) {
        case 'markdown': data = exportToMarkdown(filteredVideos, 'DopaQueue'); filename = buildExportFilename('dopaqueue', 'md'); mimeType = 'text/markdown'; break;
        case 'csv': data = exportToCSV(filteredVideos); filename = buildExportFilename('dopaqueue', 'csv'); mimeType = 'text/csv'; break;
        case 'json': data = exportToJSON(filteredVideos); filename = buildExportFilename('dopaqueue', 'json'); mimeType = 'application/json'; break;
        default: return;
      }
      downloadFile(data, filename, mimeType);
      success(`Exported ${filteredVideos.length} videos`);
    } catch (err) {
      showError('Export failed');
    }
  }, [filteredVideos, success, showError]);

  const toggleWhitelist = useCallback(async (channelName) => {
    try {
      const newWhitelist = whitelist.includes(channelName)
        ? whitelist.filter(c => c !== channelName)
        : [...whitelist, channelName];
      await saveWhitelist(newWhitelist);
      setWhitelist(newWhitelist);
      success(`${channelName} ${newWhitelist.includes(channelName) ? 'added to' : 'removed from'} whitelist`);
    } catch (err) {
      showError('Failed to update whitelist');
    }
  }, [whitelist, success, showError]);

  // Loading state
  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="xl" />
            <p className="text-[var(--theme-text-secondary)]">Loading DopaQueue...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-[var(--theme-bg)]">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[var(--theme-surface)]/80 backdrop-blur-xl border-b border-[var(--theme-border)]">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <PlayCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="font-semibold text-[var(--theme-text-primary)]">DopaQueue</h1>
                    <p className="text-xs text-[var(--theme-text-muted)]">Your video library</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ThemeToggle />
                {user ? (
                  <>
                    <Button variant="ghost" size="sm" leftIcon={<Cloud className="w-4 h-4" />} onClick={handleSync} isLoading={isSyncing}>
                      Sync
                    </Button>
                    <img src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt="User" className="w-8 h-8 rounded-full object-cover" />
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      <SettingsIcon className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" leftIcon={<LogIn className="w-4 h-4" />} onClick={handleSignIn}>
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="glass-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{videos.length}</p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">Videos</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Film className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{categories.length - 1}</p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">Categories</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Folder className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{platforms.length - 1}</p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">Platforms</p>
                  </div>
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-3.516 2.516l.01.01m-2.022 2.022l.01.01m-2.022 2.022l.01.01m2.022-4.044l-.01-.01m4.044 2.022l.01.01m-8.088 2.022L5.5 19.5m4.044-4.044l.01.01" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{analysisSummary?.averageSavesPerDay || 0}</p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">Avg/Day</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 glass-elevated rounded-xl">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]" />
                <Input placeholder="Search videos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700' : ''}`}>
                  <LayoutDashboard className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-700' : ''}`}>
                  <Film className="w-4 h-4" />
                </button>
              </div>
              
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent border border-[var(--theme-border)] rounded-lg px-2 py-1.5 text-sm">
                <option value="recent">Recent</option>
                <option value="title">Title</option>
                <option value="platform">Platform</option>
                <option value="category">Category</option>
              </select>
              
              <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
              
              <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => document.getElementById('export-menu').click()}>
                Export
              </Button>
              
              {/* Export dropdown (hidden) */}
              <div id="export-menu" className="hidden">
                <button onClick={() => handleExport('markdown')} className="hidden">Markdown</button>
                <button onClick={() => handleExport('csv')} className="hidden">CSV</button>
                <button onClick={() => handleExport('json')} className="hidden">JSON</button>
              </div>
            </div>
          </div>

          {/* Videos */}
          {filteredVideos.length === 0 ? (
            <EmptyState onBrowse={() => chrome.tabs.create({ url: 'https://youtube.com' })} />
          ) : viewMode === 'grid' ? (
            <VideoGrid 
              videos={filteredVideos} 
              onDelete={handleDelete} 
              whitelist={whitelist} 
              onToggleWhitelist={toggleWhitelist}
            />
          ) : (
            <VideoList 
              videos={filteredVideos} 
              onDelete={handleDelete} 
              whitelist={whitelist} 
              onToggleWhitelist={toggleWhitelist}
            />
          )}
        </main>
      </div>
    </OnboardingProvider>
  );
}

// Empty State Component
function EmptyState({ onBrowse }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center">
        <Film className="w-10 h-10 text-gray-500 dark:text-gray-400" />
      </div>
      <h3 className="font-semibold text-[var(--theme-text-primary)] mb-2">No videos saved yet</h3>
      <p className="text-sm text-[var(--theme-text-muted)] mb-4">Start saving videos to build your library</p>
      <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={onBrowse}>
        Browse YouTube
      </Button>
    </div>
  );
}

// Video Grid Component
function VideoGrid({ videos, onDelete, whitelist, onToggleWhitelist }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard 
          key={video.id} 
          video={video} 
          onDelete={onDelete} 
          isWhitelisted={isWhitelistedChannel(video.channel, whitelist)} 
          onToggleWhitelist={() => onToggleWhitelist(video.channel)}
        />
      ))}
    </div>
  );
}

// Video List Component
function VideoList({ videos, onDelete, whitelist, onToggleWhitelist }) {
  return (
    <div className="space-y-3">
      {videos.map((video) => (
        <VideoRow 
          key={video.id} 
          video={video} 
          onDelete={onDelete} 
          isWhitelisted={isWhitelistedChannel(video.channel, whitelist)} 
          onToggleWhitelist={() => onToggleWhitelist(video.channel)}
        />
      ))}
    </div>
  );
}

// Video Card Component
function VideoCard({ video, onDelete, isWhitelisted, onToggleWhitelist }) {
  const thumbnail = getThumbnail(video);
  const platform = extractPlatform(video.url);
  const tags = extractTags(video, 3);
  
  return (
    <Card className="glass-elevated cursor-pointer hover:shadow-glass-lg transition-all group">
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          {thumbnail ? (
            <img src={thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <Film className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" size="sm">{platform.charAt(0).toUpperCase() + platform.slice(1)}</Badge>
          </div>
          
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={(e) => { e.stopPropagation(); onToggleWhitelist(); }} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md hover:bg-white dark:hover:bg-gray-700">
              <ShieldCheck className={`w-4 h-4 ${isWhitelisted ? 'text-emerald-500' : 'text-gray-500'}`} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(video.id); }} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-medium text-[var(--theme-text-primary)] line-clamp-2 mb-2">{video.title || 'Untitled'}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {video.channel && <span className="text-xs text-[var(--theme-text-muted)]">{video.channel}</span>}
            </div>
            <span className="text-xs text-[var(--theme-text-muted)]">{formatTimeAgo(video.savedAt)}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mt-3">
              {tags.map((tag, i) => <Badge key={i} variant="default" size="sm">{tag}</Badge>)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Video Row Component
function VideoRow({ video, onDelete, isWhitelisted, onToggleWhitelist }) {
  const thumbnail = getThumbnail(video);
  const platform = extractPlatform(video.url);
  
  return (
    <Card className="glass-elevated">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
            {thumbnail ? <img src={thumbnail} alt={video.title} className="w-full h-full object-cover" /> : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                <Film className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-[var(--theme-text-primary)] truncate">{video.title || 'Untitled'}</h3>
            <p className="text-sm text-[var(--theme-text-muted)] truncate">{video.channel || 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" size="sm">{platform}</Badge>
            <span className="text-xs text-[var(--theme-text-muted)]">{formatTimeAgo(video.savedAt)}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); onToggleWhitelist(); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ShieldCheck className={`w-4 h-4 ${isWhitelisted ? 'text-emerald-500' : 'text-gray-500'}`} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(video.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export with Theme Provider
export default function Dashboard() {
  return <DashboardApp />;
}
