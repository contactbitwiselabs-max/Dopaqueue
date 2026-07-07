import React, { useEffect, useState, useCallback } from 'react';
import {
  PlayCircle, Hash, Settings, Trash2, CheckCircle,
  Clock, Download, Folder, FileText, FileSpreadsheet, LogIn, X, AlertCircle,
  LogOut, RefreshCw, Film, Zap, Image, Tag, Calendar, ChevronDown
} from 'lucide-react';
import {
  initStorage, getSavedVideos, getSavedChannels, subscribe,
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup
} from '../shared/storage.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename } from '../shared/export.js';
import { getChannelGroups, getItemsByGroup, getGroupStats } from '../shared/groups.js';
import Settings from './pages/Settings.jsx';

// ─── Helpers ───────────────────────────────────────────────────────
function csvField(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function detectContentType(url) {
  if (!url) return 'video';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  return 'video';
}

const TYPE_CONFIG = {
  video:  { label: 'Video', icon: PlayCircle, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  short:  { label: 'Short', icon: Zap,        color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  reel:   { label: 'Reel',  icon: Film,       color: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  post:   { label: 'Post',  icon: Image,      color: 'bg-green-500/15 text-green-400 border-green-500/20' },
};

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

// ─── Auth Page ─────────────────────────────────────────────────────
function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMessage('Check your email for a confirmation link!');
      } else {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthSuccess?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError(null);
    try {
      const { error: oauthError } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: chrome.runtime.getURL('dashboard.html'),
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      // Supabase returns this exact message when a provider hasn't
      // been turned on for the project yet — surface it in plain
      // language instead of the raw "provider is not enabled" JSON,
      // since that's a Supabase dashboard config step, not a bug here.
      if (/provider is not enabled/i.test(err.message)) {
        setError(
          `${provider === 'google' ? 'Google' : 'GitHub'} sign-in isn't enabled yet. ` +
          'Enable it in your Supabase project under Authentication → Providers.'
        );
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-purple-950/60 via-zinc-950 to-blue-950/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-purple-500)_0%,_transparent_60%)] opacity-20" />
        <div className="relative z-10 text-center px-12">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            DopaQueue
          </h1>
          <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
            Save videos intentionally. Watch them distraction-free. Reclaim your focus.
          </p>
          <div className="mt-12 flex gap-6 justify-center text-zinc-600">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <PlayCircle className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-xs">Videos</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-xs">Shorts</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <Film className="w-6 h-6 text-pink-400" />
              </div>
              <span className="text-xs">Reels</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
              DopaQueue
            </h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
          <p className="text-zinc-500 mb-8">{mode === 'signin' ? 'Sign in to sync across devices' : 'Get started with DopaQueue'}</p>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuth('github')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors font-medium"
            >
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs text-zinc-500 mb-1.5 font-medium">Email</label>
              <input
                id="auth-email" type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder-zinc-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs text-zinc-500 mb-1.5 font-medium">Password</label>
              <input
                id="auth-password" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder-zinc-600"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {message && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <CheckCircle className="w-4 h-4 shrink-0" /> {message}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null); }} className="text-purple-400 hover:text-purple-300 font-medium">
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>

          {/* Skip */}
          <button onClick={onAuthSuccess} className="w-full text-center text-xs text-zinc-600 mt-4 hover:text-zinc-400 transition-colors">
            Skip for now — use offline only
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [status, setStatus] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const refreshData = useCallback(() => {
    setVideos(getSavedVideos());
    setChannels(getSavedChannels());
  }, []);

  useEffect(() => {
    initStorage().then(() => {
      refreshData();
      setAuthChecked(true);
    });

    const unsubQueue = subscribe('dq_queue', refreshData);

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setShowAuth(false);
    });

    return () => {
      unsubQueue();
      authListener.subscription.unsubscribe();
    };
  }, [refreshData]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleDelete = (id) => {
    removeFromQueue(id);
    refreshData();
  };

  const handleSync = async () => {
    if (!user) { setShowAuth(true); return; }
    setIsSyncing(true);
    setStatus(null);
    try {
      await syncWithCloud();
      refreshData();
      setStatus({ type: 'success', message: 'Synced successfully!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
    setStatus({ type: 'success', message: 'Signed out.' });
  };

  const handleExport = (video, format = 'markdown') => {
    const scrape = getScrapeResult(video.url);
    if (!scrape || !scrape.transcript) {
      setStatus({ type: 'error', message: 'No transcript available yet. Visit the video with the extension active first.' });
      return;
    }

    // Build a single-item array so we can reuse the shared export helpers
    // (which expect an iterable of items with transcript/channel metadata).
    const item = {
      title: video.title,
      url: video.url,
      type: detectContentType(video.url),
      genre: scrape.genre || 'Unknown',
      channel: scrape.channel || 'Unknown',
      savedAt: video.savedAt,
      transcript: scrape.transcript,
    };

    let content;
    let filename;
    let mimeType;
    switch (format) {
      case 'markdown':
        content = exportToMarkdown([item], video.title);
        filename = buildExportFilename('markdown', video.title);
        mimeType = 'text/markdown';
        break;
      case 'csv':
        content = exportToCSV([item]);
        filename = buildExportFilename('csv', video.title);
        mimeType = 'text/csv';
        break;
      case 'json':
        content = exportToJSON([item]);
        filename = buildExportFilename('json', video.title);
        mimeType = 'application/json';
        break;
      case 'notion':
        content = exportToNotion([item]);
        filename = buildExportFilename('markdown', `${video.title}-notion`);
        mimeType = 'text/markdown';
        break;
      default:
        return;
    }

    downloadFile(content, filename, mimeType);
  };

  // Bulk export — exports the entire queue (videos + channels) in one file.
  // Falls back to whatever scrape data we have cached; items without
  // transcripts are still included so users don't lose their queue.
  const handleBulkExport = (format) => {
    const items = videos.map((v) => {
      const scrape = getScrapeResult(v.url) || {};
      return {
        title: v.title,
        url: v.url,
        type: detectContentType(v.url),
        genre: scrape.genre || 'Unknown',
        channel: scrape.channel || 'Unknown',
        savedAt: v.savedAt,
        transcript: scrape.transcript || '',
      };
    });

    let content;
    let filename;
    let mimeType;
    switch (format) {
      case 'markdown':
        content = exportToMarkdown(items, 'My Saved Videos');
        filename = buildExportFilename('markdown', 'queue');
        mimeType = 'text/markdown';
        break;
      case 'csv':
        content = exportToCSV(items);
        filename = buildExportFilename('csv', 'queue');
        mimeType = 'text/csv';
        break;
      case 'json':
        content = exportToJSON(items);
        filename = buildExportFilename('json', 'queue');
        mimeType = 'application/json';
        break;
      case 'notion':
        content = exportToNotion(items);
        filename = buildExportFilename('markdown', 'queue-notion');
        mimeType = 'text/markdown';
        break;
      default:
        return;
    }

    downloadFile(content, filename, mimeType);
    setStatus({ type: 'success', message: `Exported ${items.length} items as ${format.toUpperCase()}` });
  };

  if (!authChecked) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showAuth) {
    return <AuthPage onAuthSuccess={() => setShowAuth(false)} />;
  }

  // Filter videos by content type
  const filteredVideos = filterType === 'all'
    ? videos
    : videos.filter(v => detectContentType(v.url) === filterType);

  // Count by type for category chips
  const typeCounts = videos.reduce((acc, v) => {
    const t = detectContentType(v.url);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">

      {/* ─── Sidebar ─── */}
      <div className="w-64 bg-zinc-900/50 border-r border-white/5 p-4 flex flex-col backdrop-blur-xl shrink-0">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-8 px-2">
          DopaQueue
        </h1>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<PlayCircle />} label="Saved Videos" count={videos.length} />
          <NavItem active={activeTab === 'channels'} onClick={() => setActiveTab('channels')} icon={<Hash />} label="Channels" count={channels.length} />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4 space-y-2">
          {!user ? (
            <button onClick={() => setShowAuth(true)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              <LogIn className="w-4 h-4" /> Sign In to Sync
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 truncate">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-[10px] shrink-0">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={handleSync} disabled={isSyncing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all font-medium disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
              </button>
              <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Main ─── */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-purple-500/10 blur-[100px] pointer-events-none rounded-full" />

        {/* Toast */}
        {status && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${
            status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="text-sm">{status.message}</span>
            <button onClick={() => setStatus(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="max-w-6xl mx-auto relative z-10">

          {/* ─── Videos Tab ─── */}
          {activeTab === 'videos' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Your Video Queue</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500">{filteredVideos.length} items</span>
                  <div className="relative">
                    <select
                      onChange={(e) => { if (e.target.value) { handleBulkExport(e.target.value); e.target.value = ''; } }}
                      className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg pl-3 pr-8 py-1.5 hover:border-zinc-700 focus:outline-none focus:border-purple-500 cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>Export all…</option>
                      <option value="markdown">Markdown</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="notion">Notion</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" />
                  </div>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" count={videos.length} />
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  typeCounts[key] > 0 && (
                    <FilterChip key={key} active={filterType === key} onClick={() => setFilterType(key)} label={cfg.label} count={typeCounts[key] || 0} />
                  )
                ))}
              </div>

              {filteredVideos.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{videos.length === 0 ? 'No videos saved yet. Save a video using the extension!' : 'No items match this filter.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVideos.map(video => (
                    <VideoCard key={video.id} video={video} onRemove={() => handleDelete(video.id)} onExport={handleExport} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Channels Tab ─── */}
          {activeTab === 'channels' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Saved Channels</h2>
              {channels.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No channels saved. Save a channel from YouTube to organize them here.</p>
                </div>
              ) : (
                <ChannelList channels={channels} onDelete={handleDelete} />
              )}
            </div>
          )}

          {/* ─── Settings Tab ─── */}
          {activeTab === 'settings' && (
            <Settings
              user={user}
              onSignOut={handleSignOut}
              onSync={handleSync}
              isSyncing={isSyncing}
              onStatus={setStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
        active
          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
          : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
      }`}
    >
      {label}
      <span className={`text-xs ${active ? 'text-purple-400' : 'text-zinc-600'}`}>{count}</span>
    </button>
  );
}

function NavItem({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-zinc-800/80 text-white shadow-lg border border-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon, { className: 'w-5 h-5' })}
        <span className="font-medium">{label}</span>
      </div>
      {count !== undefined && (
        <span className={`text-xs py-0.5 px-2 rounded-full ${active ? 'bg-purple-500/20 text-purple-300' : 'bg-zinc-800 text-zinc-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function VideoCard({ video, onRemove, onExport }) {
  const contentType = detectContentType(video.url);
  const typeInfo = TYPE_CONFIG[contentType] || TYPE_CONFIG.video;
  const TypeIcon = typeInfo.icon;

  let thumbUrl = '';
  const ytMatch = video.url.match(/v=([^&]+)/) || video.url.match(/youtu\.be\/([^?]+)/) || video.url.match(/shorts\/([^?/]+)/);
  if (ytMatch) {
    thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  }

  const [showExport, setShowExport] = useState(false);
  const scrapeResult = getScrapeResult(video.url);

  return (
    <div className="group bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
      <div className="h-40 bg-zinc-800 relative overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <PlayCircle className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent pointer-events-none" />

        {/* Type badge */}
        <div className={`absolute top-3 left-3 flex items-center gap-1 text-xs px-2 py-1 rounded-md border backdrop-blur-md ${typeInfo.color}`}>
          <TypeIcon className="w-3 h-3" /> {typeInfo.label}
        </div>

        {video.watched && (
          <div className="absolute top-3 right-3 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md">
            <CheckCircle className="w-3 h-3" /> Watched
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-white leading-tight mb-2 line-clamp-2" title={video.title}>
          {video.title}
        </h3>

        {/* Date + Time */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDateTime(video.savedAt)}</span>
        </div>

        {/* Description if any */}
        {video.description && (
          <p className="text-xs text-zinc-600 line-clamp-2 mb-3">{video.description}</p>
        )}

        <div className="flex items-center gap-2 mt-4 relative">
          <a
            href={video.url} target="_blank" rel="noreferrer"
            className="flex-1 bg-white text-black text-sm font-medium py-2 rounded-xl text-center hover:bg-zinc-200 transition-colors"
          >
            Watch
          </a>

          {scrapeResult?.transcript ? (
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                title="Export Transcript"
              >
                <Download className="w-5 h-5" />
              </button>
              {showExport && (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-zinc-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                  <button onClick={() => { onExport(video, 'markdown'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Markdown</button>
                  <button onClick={() => { onExport(video, 'csv'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV</button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 bg-zinc-800/50 rounded-xl flex items-center text-center leading-none">
              No<br/>Transcript
            </div>
          )}

          <button
            onClick={onRemove}
            className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 bg-zinc-800 rounded-xl transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelList({ channels, onDelete }) {
  const grouped = channels.reduce((acc, channel) => {
    const groupName = channel.group || 'Ungrouped';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(channel);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([groupName, items]) => (
        <div key={groupName} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-800 rounded-lg"><Folder className="w-5 h-5 text-purple-400" /></div>
            <h3 className="text-xl font-bold">{groupName}</h3>
            <span className="text-zinc-500 text-sm ml-auto">{items.length} channels</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(channel => (
              <div key={channel.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold truncate">{channel.title}</h4>
                  <a href={channel.url} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline mt-1 block">Visit Channel</a>
                  <span className="text-xs text-zinc-600 mt-1 block">{formatDateTime(channel.savedAt)}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <select
                    className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
                    value={channel.group || ''}
                    onChange={(e) => updateChannelGroup(channel.id, e.target.value)}
                  >
                    <option value="">Ungrouped</option>
                    <option value="Learning">Learning</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Tech">Tech</option>
                  </select>
                  <button onClick={() => onDelete(channel.id)} className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
