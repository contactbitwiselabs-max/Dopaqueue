import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  PlayCircle, Hash, Settings as SettingsIcon, Trash2, CheckCircle,
  Clock, Download, Folder, FileText, FileSpreadsheet, LogIn, X, AlertCircle,
  LogOut, RefreshCw, Film, Zap, Image, Calendar, ChevronDown, Search, Plus,
  Sparkles, CheckSquare, Share2, Users, Copy, ExternalLink, ShieldCheck, Award, TrendingUp,
  Send, Timer, Pause, Play, Shield
} from 'lucide-react';
import {
  initStorage, getSavedVideos, getSavedChannels, subscribe,
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup,
  getWhitelist, saveWhitelist, isWhitelistedChannel, getPomodoroState, savePomodoroState
} from '../shared/storage.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename, pushToWebhook, formatWithTemplate } from '../shared/export.js';
import { generateActionChecklist, autoTagItem } from '../shared/ai.js';
import { generateSharePayload, encodeShareLink } from '../shared/share.js';
import { getMyCircle, createCircle, joinCircleByCode, getWeeklyMirrorReport } from '../shared/circles.js';
import { SHARE_BASE_URL } from '../shared/constants.js';
import Settings from './pages/Settings.jsx';

// ─── Helpers ───────────────────────────────────────────────────────

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
        const { error: signUpError } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: chrome.runtime.getURL('dashboard.html'),
          },
        });
        if (signUpError) throw signUpError;
        setMessage('sent');
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
    <div className="flex h-screen bg-[#0a0a08] text-white font-sans">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-lime-950/40 via-zinc-950 to-emerald-950/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-lime-500)_0%,_transparent_60%)] opacity-15" />
        <div className="relative z-10 text-center px-12">
          <h1 className="text-5xl font-black text-white mb-4">
            <span aria-hidden>{"\ud83c\udf3f"}</span> DopaQueue
          </h1>
          <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
            Save videos intentionally. Watch them distraction-free. Reclaim your focus.
          </p>
          <div className="mt-12 flex gap-6 justify-center text-zinc-600">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <PlayCircle className="w-6 h-6 text-lime-400" />
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
            <h1 className="text-3xl font-bold text-white">
              <span aria-hidden>{"\ud83c\udf3f"}</span> DopaQueue
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

            {/* GitHub OAuth removed per user request */}
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
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-all placeholder-zinc-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs text-zinc-500 mb-1.5 font-medium">Password</label>
              <input
                id="auth-password" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-all placeholder-zinc-600"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {message && (
              <div className="text-sm text-lime-400 bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 space-y-2.5 shadow-lg">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle className="w-5 h-5 shrink-0 text-lime-400" />
                  Verify Your Email Address
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  We sent a confirmation link to <span className="text-white font-medium">{email}</span>. Click the verification link in your email to activate your DopaQueue account.
                </p>
                <div className="pt-1 flex gap-2">
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400 text-zinc-950 font-semibold text-xs hover:bg-lime-300 transition-colors"
                  >
                    Open Gmail
                  </a>
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setMessage(null); }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white font-medium text-xs transition-colors"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-lime-500/20"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null); }} className="text-lime-400 hover:text-lime-300 font-medium">
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

function PomodoroBar() {
  const [seconds, setSeconds] = useState(1500);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (active && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0 && active) {
      setActive(false);
      alert('Focus Block completed! Great session.');
    }
    return () => clearInterval(interval);
  }, [active, seconds]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div className="mb-6 p-3.5 bg-gradient-to-r from-lime-950/40 via-zinc-900/60 to-lime-950/40 border border-lime-500/30 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-lime-500/20 border border-lime-500/30 flex items-center justify-center text-lime-400">
          <Timer className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-lime-400">Deep Focus Mode</div>
          <div className="text-sm font-bold text-white">Pomodoro Focus Block · <span className="font-mono text-lime-300">{timeStr}</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActive(!active)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            active ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-lime-400 text-black hover:bg-lime-300'
          }`}
        >
          {active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Start Focus</>}
        </button>
        <button
          onClick={() => { setActive(false); setSeconds(1500); }}
          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
        >
          Reset (25m)
        </button>
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
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingVideo, setReadingVideo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const searchInputRef = useRef(null);

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
      if (typeof window !== 'undefined' && window.location.search.includes('auth=true')) {
        setShowAuth(true);
      }
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        setShowAuth(false);
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });

    return () => {
      unsubQueue();
      authListener.subscription.unsubscribe();
    };
  }, [refreshData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleDelete = (id) => {
    removeFromQueue(id);
    refreshData();
  };

  const handleUpdateTags = (id, tags) => {
    updateQueueItem(id, { tags });
    refreshData();
  };

  const handleSetUrgency = (id, urgency) => {
    updateQueueItem(id, { urgency });
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
      tags: video.tags || [],
      urgency: video.urgency || null,
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
        tags: v.tags || [],
        urgency: v.urgency || null,
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
      <div className="flex h-screen bg-[#0a0a08] items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-lime-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showAuth) {
    return (
      <AuthPage
        onAuthSuccess={async () => {
          const { data: { session } } = await supabaseClient.auth.getSession();
          setUser(session?.user || null);
          setShowAuth(false);
        }}
      />
    );
  }

  // Filter videos by content type, review urgency, and search query
  const filteredVideos = videos.filter(v => {
    if (filterType !== 'all' && detectContentType(v.url) !== filterType) return false;
    if (filterUrgency !== 'all' && (v.urgency || 'Unscheduled') !== filterUrgency) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = (v.title || '').toLowerCase().includes(q);
    const tagMatch = (v.tags || []).some(t => t.toLowerCase().includes(q));
    const scrape = getScrapeResult(v.url) || {};
    const transcriptMatch = (scrape.transcript || '').toLowerCase().includes(q);
    const channelMatch = (scrape.channel || '').toLowerCase().includes(q);
    return titleMatch || tagMatch || transcriptMatch || channelMatch;
  });

  // Count by type for category chips
  const typeCounts = videos.reduce((acc, v) => {
    const t = detectContentType(v.url);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Count by urgency review deck
  const urgencyCounts = videos.reduce((acc, v) => {
    const u = v.urgency || 'Unscheduled';
    acc[u] = (acc[u] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-[#0a0a08] text-white font-sans overflow-hidden">

      {/* ─── Sidebar ─── */}
      <div className="w-64 bg-zinc-900/50 border-r border-white/5 p-4 flex flex-col backdrop-blur-xl shrink-0">
        <h1 className="text-2xl font-bold text-white mb-8 px-2 flex items-center gap-2">
          <span aria-hidden>{"\ud83c\udf3f"}</span>DopaQueue
        </h1>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<PlayCircle />} label="Saved Videos" count={videos.length} />
          <NavItem active={activeTab === 'channels'} onClick={() => setActiveTab('channels')} icon={<Hash />} label="Channels" count={channels.length} />
          <NavItem active={activeTab === 'circles'} onClick={() => setActiveTab('circles')} icon={<Users />} label="Focus Circles" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon />} label="Settings" />
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4 space-y-2">
          {!user ? (
            <button onClick={() => setShowAuth(true)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              <LogIn className="w-4 h-4" /> Sign In to Sync
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 truncate">
                <div className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400 font-bold text-[10px] shrink-0">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={handleSync} disabled={isSyncing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 border border-lime-500/20 transition-all font-medium disabled:opacity-60"
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-lime-500/10 blur-[100px] pointer-events-none rounded-full" />

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

// ─── Main Content ──────────────────────────────────────────────────
        <div className="max-w-6xl mx-auto relative z-10">
          <PomodoroBar />

          {/* ─── Videos Tab ─── */}
          {activeTab === 'videos' && (
            <div>
              {readingVideo && <ArticleModal video={readingVideo} onClose={() => setReadingVideo(null)} />}
              {showShareModal && <ShareModal videos={filteredVideos} onClose={() => setShowShareModal(false)} onStatus={setStatus} />}
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-3xl font-bold">Your Video Queue</h2>
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search titles, #tags, or spoken transcript (Cmd+K)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-xl pl-9 pr-8 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition-colors shadow-inner"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-500/20 text-lime-300 border border-lime-500/30 text-xs font-semibold hover:bg-lime-500/30 transition-colors shrink-0"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share Playlist
                  </button>
                  <span className="text-sm text-zinc-500 shrink-0">{filteredVideos.length} items</span>
                  <div className="relative">
                    <select
                      onChange={(e) => { if (e.target.value) { handleBulkExport(e.target.value); e.target.value = ''; } }}
                      className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg pl-3 pr-8 py-1.5 hover:border-zinc-700 focus:outline-none focus:border-lime-500 cursor-pointer"
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
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs text-zinc-500 mr-1">Type:</span>
                <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" count={videos.length} />
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  typeCounts[key] > 0 && (
                    <FilterChip key={key} active={filterType === key} onClick={() => setFilterType(key)} label={cfg.label} count={typeCounts[key] || 0} />
                  )
                ))}
              </div>

              {/* Urgency Review Deck Chips */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-xs text-zinc-500 mr-1">Review Deck:</span>
                <FilterChip active={filterUrgency === 'all'} onClick={() => setFilterUrgency('all')} label="All Decks" />
                {['Tomorrow', 'Weekend', 'Reference'].map(u => (
                  <FilterChip key={u} active={filterUrgency === u} onClick={() => setFilterUrgency(u)} label={u} count={urgencyCounts[u] || 0} />
                ))}
              </div>

              {filteredVideos.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{videos.length === 0 ? 'No videos saved yet. Save a video using the extension!' : 'No items match your search or filter.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVideos.map(video => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onRemove={() => handleDelete(video.id)}
                      onExport={handleExport}
                      onReadArticle={() => setReadingVideo(video)}
                      onUpdateTags={handleUpdateTags}
                      onSetUrgency={handleSetUrgency}
                    />
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

          {/* ─── Focus Circles Tab ─── */}
          {activeTab === 'circles' && <AccountabilityCirclesView videos={videos} />}

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
          ? 'bg-lime-500/15 text-lime-300 border-lime-500/30'
          : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
      }`}
    >
      {label}
      {count != null && (
        <span className={`text-xs ${active ? 'text-lime-400' : 'text-zinc-600'}`}>{count}</span>
      )}
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
        <span className={`text-xs py-0.5 px-2 rounded-full ${active ? 'bg-lime-500/20 text-lime-300' : 'bg-zinc-800 text-zinc-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ArticleModal({ video, onClose }) {
  const scrape = getScrapeResult(video.url) || {};
  const [activeModalTab, setActiveModalTab] = useState('notes'); // 'notes' | 'transcript'
  const [userNotes, setUserNotes] = useState(video.userNotes || video.description || '');
  const [manualTranscript, setManualTranscript] = useState(video.manualTranscript || scrape.transcript || '');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState(video.tags || []);

  const handleSaveNotes = () => {
    updateQueueItem(video.id, {
      userNotes,
      description: userNotes,
      manualTranscript,
      tags,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const clean = newTag.trim().replace(/^#/, '');
    if (!tags.includes(clean)) {
      const nextTags = [...tags, clean];
      setTags(nextTags);
      updateQueueItem(video.id, { tags: nextTags });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const nextTags = tags.filter(t => t !== tagToRemove);
    setTags(nextTags);
    updateQueueItem(video.id, { tags: nextTags });
  };

  const activeTranscriptText = manualTranscript || scrape.transcript || '';
  const paragraphs = activeTranscriptText
    ? activeTranscriptText.split(/(?<=\.)\s+/).reduce((acc, sentence, idx) => {
        const pIdx = Math.floor(idx / 5);
        acc[pIdx] = (acc[pIdx] || '') + ' ' + sentence;
        return acc;
      }, [])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900/95 border border-white/10 rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/90 sticky top-0 z-10">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2.5">
              <button
                onClick={() => setActiveModalTab('notes')}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all border flex items-center gap-1.5 ${
                  activeModalTab === 'notes'
                    ? 'bg-lime-500/20 text-lime-300 border-lime-500/30 shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-lime-400" /> Notes & Organization
              </button>
              <button
                onClick={() => setActiveModalTab('transcript')}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all border flex items-center gap-1.5 ${
                  activeModalTab === 'transcript'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" /> Transcript & Text
              </button>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight line-clamp-1">{video.title}</h2>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
              <span>{scrape.channel || video.channel || 'Video Queue Item'}</span>
              <span>·</span>
              <span>Saved {formatDateTime(video.savedAt)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedFeedback && (
              <span className="text-xs font-semibold text-lime-400 bg-lime-400/10 px-3 py-1 rounded-full border border-lime-400/20 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors border border-white/5"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-7 overflow-y-auto flex-1">
          {activeModalTab === 'notes' ? (
            <div className="space-y-6">
              {/* Custom Tags Section */}
              <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Categorize & Tag Item
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-lime-500/15 text-lime-300 border border-lime-500/30 shadow-sm"
                    >
                      #{t}
                      <button
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-white font-bold ml-1 text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <form onSubmit={handleAddTag} className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="Add tag (e.g. tutorial, priority)..."
                      className="bg-zinc-900 border border-white/10 text-xs text-white rounded-xl px-3 py-1.5 w-52 focus:outline-none focus:border-lime-400 transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-white/5"
                    >
                      + Add Tag
                    </button>
                  </form>
                </div>
              </div>

              {/* Personal Notes / Action Items Section */}
              <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Personal Notes, Takeaways & Timestamps
                  </label>
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-lime-500/10"
                  >
                    Save Notes
                  </button>
                </div>
                <textarea
                  value={userNotes}
                  onChange={e => setUserNotes(e.target.value)}
                  placeholder="Write notes, summarize key points, or record important timestamps here..."
                  className="w-full h-52 bg-zinc-900/80 border border-white/10 rounded-xl p-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-lime-400/50 transition-colors leading-relaxed resize-y font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-zinc-950/60 border border-white/10 rounded-2xl p-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Spoken Transcript & Captions</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEditingTranscript ? 'Paste or edit manual transcript text below.' : 'View or export video transcript text.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (isEditingTranscript) handleSaveNotes();
                    setIsEditingTranscript(!isEditingTranscript);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-white/10"
                >
                  {isEditingTranscript ? 'Done Editing' : 'Edit / Paste Manual Transcript'}
                </button>
              </div>

              {isEditingTranscript ? (
                <textarea
                  value={manualTranscript}
                  onChange={e => setManualTranscript(e.target.value)}
                  placeholder="Paste video transcript or captions here..."
                  className="w-full h-80 bg-zinc-950 border border-white/10 rounded-2xl p-5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 leading-relaxed font-mono resize-y"
                />
              ) : paragraphs.length > 0 && paragraphs[0].trim() ? (
                <div className="space-y-4 text-zinc-300 leading-relaxed font-serif text-base selection:bg-lime-500/30 bg-zinc-950/40 p-6 rounded-2xl border border-white/5">
                  {paragraphs.map((para, idx) => (
                    <p key={idx} className="mb-3">{para.trim()}</p>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-zinc-950/40 border border-white/5 rounded-2xl">
                  <p className="text-zinc-500 text-sm mb-4">No automatic transcript was fetched for this item.</p>
                  <button
                    onClick={() => setIsEditingTranscript(true)}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold rounded-xl border border-blue-500/30 transition-colors"
                  >
                    + Paste Manual Transcript
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-white/10 bg-zinc-950 flex items-center justify-between">
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-lime-500/10"
          >
            Open Video on YouTube ↗
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveNotes}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm rounded-xl transition-all border border-white/10"
            >
              Save All Changes
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium text-sm rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onRemove, onExport, onReadArticle, onUpdateTags, onSetUrgency }) {
  const contentType = detectContentType(video.url);
  const typeInfo = TYPE_CONFIG[contentType] || TYPE_CONFIG.video;
  const TypeIcon = typeInfo.icon;

  let thumbUrl = '';
  const ytMatch = video.url.match(/v=([^&]+)/) || video.url.match(/youtu\.be\/([^?]+)/) || video.url.match(/shorts\/([^?/]+)/);
  if (ytMatch) {
    thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  }

  const [showExport, setShowExport] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [pushingVault, setPushingVault] = useState(false);
  const scrapeResult = getScrapeResult(video.url);

  const urgencyCycle = ['Tomorrow', 'Weekend', 'Reference', null];
  const currentUrgency = video.urgency || null;
  const urgencyColor = {
    Tomorrow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Weekend: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Reference: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  };

  const handleCycleUrgency = () => {
    const nextIdx = (urgencyCycle.indexOf(currentUrgency) + 1) % urgencyCycle.length;
    onSetUrgency(video.id, urgencyCycle[nextIdx]);
  };

  const handleAutoTag = () => {
    const autoTags = autoTagItem(video.title, scrapeResult?.transcript || '', video.url);
    const currentTags = new Set(video.tags || []);
    autoTags.forEach(t => currentTags.add(t));
    onUpdateTags(video.id, Array.from(currentTags));
  };

  const handleShareCard = async () => {
    try {
      const payload = generateSharePayload(video.title, 'DopaQueue User', [video]);
      const link = encodeShareLink(payload, SHARE_BASE_URL);
      const textToCopy = `${video.title}\n${video.url}\n\nShareable Review Deck: ${link}`;
      await navigator.clipboard.writeText(textToCopy);
      alert('Video & review link copied to clipboard!');
    } catch (err) {
      alert('Video link: ' + video.url);
    }
  };

  const handlePushVault = async () => {
    setPushingVault(true);
    try {
      let webhookUrl = '';
      let templateStr = '';
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await new Promise(r => chrome.storage.local.get(['dq_webhook_url', 'dq_export_template'], r));
        webhookUrl = res.dq_webhook_url;
        templateStr = res.dq_export_template;
      }
      if (!webhookUrl) {
        alert('Please configure your Vault Webhook URL in Settings first.');
        setPushingVault(false);
        return;
      }
      const payloadText = formatWithTemplate(video, scrapeResult?.transcript, templateStr);
      const result = await pushToWebhook(webhookUrl, {
        title: video.title,
        url: video.url,
        formattedText: payloadText,
        timestamp: Date.now()
      });
      if (result.success) {
        alert('Item pushed to Vault successfully!');
      } else {
        alert('Failed to push: ' + (result.error || 'Check Webhook configuration'));
      }
    } catch (err) {
      alert('Error pushing to Vault: ' + err.message);
    } finally {
      setPushingVault(false);
    }
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const tagClean = newTag.trim().replace(/^#/, '');
    const currentTags = video.tags || [];
    if (!currentTags.includes(tagClean)) {
      onUpdateTags(video.id, [...currentTags, tagClean]);
    }
    setNewTag('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    const currentTags = video.tags || [];
    onUpdateTags(video.id, currentTags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="group bg-zinc-900/80 border border-white/10 rounded-2xl overflow-hidden hover:border-white/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-lime-500/10 flex flex-col">
      {/* Card Thumbnail Deck */}
      <div className="h-44 bg-zinc-950 relative overflow-hidden shrink-0">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover opacity-85 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <PlayCircle className="w-12 h-12 text-zinc-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/40 pointer-events-none" />

        {/* Content Type Badge */}
        <div className={`absolute top-3 left-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-md ${typeInfo.color}`}>
          <TypeIcon className="w-3.5 h-3.5" /> {typeInfo.label}
        </div>

        {/* Urgency Review Deck Selector */}
        <div className="absolute top-3 right-3">
          <button
            onClick={handleCycleUrgency}
            className={`text-xs font-semibold px-3 py-1 rounded-full border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-sm ${
              currentUrgency
                ? urgencyColor[currentUrgency]
                : 'bg-zinc-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
            }`}
            title="Click to cycle review urgency (Tomorrow -> Weekend -> Reference)"
          >
            <Clock className="w-3.5 h-3.5" /> {currentUrgency || 'Set Priority'}
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <h3 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-lime-300 transition-colors" title={video.title}>
            {video.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Saved {formatDateTime(video.savedAt)}</span>
          </div>

          {/* Interactive Tags Section */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {(video.tags || []).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-lime-400/15 text-lime-300 border border-lime-400/30 shadow-sm"
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-white font-extrabold ml-1"
                  aria-label="Remove tag"
                >
                  ×
                </button>
              </span>
            ))}
            {showTagInput ? (
              <form onSubmit={handleAddTag} className="inline-flex items-center">
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  placeholder="tag name..."
                  autoFocus
                  onBlur={() => setShowTagInput(false)}
                  className="bg-zinc-950 border border-lime-400 text-xs text-white rounded-full px-2.5 py-0.5 w-24 focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-white/5 transition-colors"
              >
                <Plus className="w-3 h-3" /> Tag
              </button>
            )}
          </div>

          {/* Custom Notes / Description snippet if existing */}
          {(video.userNotes || video.description) && (
            <p className="text-xs text-zinc-400 line-clamp-2 bg-zinc-950/50 p-2.5 rounded-xl border border-white/5 font-sans leading-relaxed">
              <span className="font-semibold text-zinc-300">Note: </span>
              {video.userNotes || video.description}
            </p>
          )}
        </div>

        {/* Enterprise Actions Footer */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 bg-lime-400 hover:bg-lime-300 text-zinc-950 text-xs font-bold py-2.5 rounded-xl text-center transition-all shadow-md shadow-lime-500/10 flex items-center justify-center gap-1.5"
          >
            <span>Watch</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => onReadArticle(video)}
            className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl transition-all text-xs font-semibold border border-white/10 flex items-center gap-1.5"
            title="Manage Notes, Tags & Transcript"
          >
            <FileText className="w-3.5 h-3.5 text-lime-400" />
            <span>Manage & Notes</span>
          </button>

          <button
            onClick={handleShareCard}
            className="p-2.5 text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-xl transition-colors border border-blue-500/20"
            title="Copy Shareable Review Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={onRemove}
            className="p-2.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 bg-zinc-800/80 rounded-xl transition-colors border border-white/5"
            title="Delete from Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelList({ channels, onDelete }) {
  const [whitelist, setWhitelist] = useState(getWhitelist());

  const toggleWhitelist = (title) => {
    if (!title) return;
    const current = getWhitelist();
    const isW = current.some(c => c.toLowerCase() === title.toLowerCase());
    const updated = isW
      ? current.filter(c => c.toLowerCase() !== title.toLowerCase())
      : [...current, title];
    saveWhitelist(updated);
    setWhitelist(updated);
  };

  const grouped = channels.reduce((acc, channel) => {
    const groupName = channel.group || 'Ungrouped';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(channel);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="bg-lime-500/10 border border-lime-500/30 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-lime-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-lime-400" /> Deep Focus Whitelisted Channels ({whitelist.length})
          </h4>
          <p className="text-xs text-zinc-400 mt-1">
            Watching videos from whitelisted educational channels will not decay your daily Dopamine Budget.
          </p>
        </div>
      </div>

      {Object.entries(grouped).map(([groupName, items]) => (
        <div key={groupName} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-800 rounded-lg"><Folder className="w-5 h-5 text-lime-400" /></div>
            <h3 className="text-xl font-bold">{groupName}</h3>
            <span className="text-zinc-500 text-sm ml-auto">{items.length} channels</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(channel => {
              const isW = whitelist.some(c => c.toLowerCase() === (channel.title || '').toLowerCase());
              return (
                <div key={channel.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{channel.title}</h4>
                      {isW && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 font-semibold">
                          Whitelisted
                        </span>
                      )}
                    </div>
                    <a href={channel.url} target="_blank" rel="noreferrer" className="text-xs text-lime-400 hover:underline mt-1 block">Visit Channel</a>
                    <span className="text-xs text-zinc-600 mt-1 block">{formatDateTime(channel.savedAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => toggleWhitelist(channel.title)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isW
                          ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-white/5 hover:text-white hover:bg-zinc-700'
                      }`}
                      title="Exempt this channel from dopamine budget countdown"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                      {isW ? 'Focus Exempt' : 'Whitelist'}
                    </button>

                    <select
                      className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-lime-500"
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
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Share Modal Component ──────────────────────────────────────────
function ShareModal({ videos, onClose, onStatus }) {
  const [title, setTitle] = useState('My DopaQueue Review Deck');
  const [curator, setCurator] = useState('Focused Mind');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const payload = generateSharePayload(title, curator, videos);
    const link = encodeShareLink(payload, SHARE_BASE_URL);
    setShareUrl(link);
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onStatus) onStatus({ type: 'success', message: 'Public playlist URL copied to clipboard!' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-lime-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-500/20 border border-lime-500/30 flex items-center justify-center text-lime-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Share Public Playlist</h3>
              <p className="text-xs text-zinc-400">Export your curated review queue as a shareable link</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Playlist Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500"
              placeholder="e.g. AI & Distributed Systems Watchlist"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Curator Name</label>
            <input
              type="text"
              value={curator}
              onChange={e => setCurator(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500"
              placeholder="Your Name or Handle"
            />
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Included Items:</span>
              <span className="font-semibold text-lime-400">{videos.length} videos</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              All selected videos, tags, and AI summaries will be packaged into a standalone public link.
            </p>
          </div>

          {shareUrl ? (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Generated Share URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-zinc-950 border border-lime-500/40 rounded-xl px-3.5 py-2.5 text-xs font-mono text-lime-300 focus:outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-xl bg-lime-400 text-black font-semibold text-xs hover:bg-lime-300 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm transition-colors"
            >
              Generate Shareable Playlist Link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accountability Circles Component ───────────────────────────────
function AccountabilityCirclesView({ videos }) {
  const [circle, setCircle] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [newCircleName, setNewCircleName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    getMyCircle().then(res => setCircle(res));
  }, []);

  const report = getWeeklyMirrorReport(videos);

  const handleCreateCircle = (e) => {
    e.preventDefault();
    const c = createCircle(newCircleName || 'Focus Squad');
    setCircle(c);
    setShowCreate(false);
  };

  const handleJoinCircle = (e) => {
    e.preventDefault();
    if (!joinCode) return;
    const c = joinCircleByCode(joinCode);
    setCircle(c);
    setShowJoin(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Accountability Circles & Weekly Mirror</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Compare your weekly dopamine balance anonymously with your focus squad
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowJoin(!showJoin)}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium hover:border-zinc-700 transition-colors"
          >
            Join Circle
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-xl bg-lime-400 text-black font-semibold text-sm hover:bg-lime-300 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Circle
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateCircle} className="p-5 bg-zinc-900 border border-lime-500/30 rounded-2xl flex items-center gap-3 max-w-lg">
          <input
            type="text"
            placeholder="Circle Name (e.g. Deep Work Founders)"
            value={newCircleName}
            onChange={e => setNewCircleName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-lime-400 text-black font-semibold text-xs">Create</button>
        </form>
      )}

      {showJoin && (
        <form onSubmit={handleJoinCircle} className="p-5 bg-zinc-900 border border-lime-500/30 rounded-2xl flex items-center gap-3 max-w-lg">
          <input
            type="text"
            placeholder="Invite Code (e.g. DQ-8A9F-204)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-lime-500"
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-lime-400 text-black font-semibold text-xs">Join</button>
        </form>
      )}

      {/* ─── Weekly Attention Mirror Scorecard ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Mindless Scroll Time</span>
            <ShieldCheck className="w-5 h-5 text-lime-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{report.mindlessMinutesAvg}m <span className="text-sm font-normal text-zinc-400">/ day</span></div>
          <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> 28% better than average doomscroller
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Review & Revisit Rate</span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{report.revisitRate}%</div>
          <p className="text-xs text-zinc-400 mt-2">
            Of saved queue items revisited or processed
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estimated Time Saved</span>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{report.hoursSavedEst} hrs</div>
          <p className="text-xs text-blue-400 mt-2">
            Speed Bump intervened {report.speedBumpInterventions} times this week
          </p>
        </div>
      </div>

      {/* ─── Circle Leaderboard / Member Comparison ─── */}
      {circle ? (
        <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{circle.name}</h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30">
                  {circle.code}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Active squad members comparing weekly metrics</p>
            </div>
          </div>

          <div className="space-y-3">
            {circle.members.map((m, idx) => (
              <div key={m.id} className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm">{m.name}</span>
                    {m.id === 'me' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full">You</span>}
                  </div>
                </div>

                <div className="flex items-center gap-8 text-right">
                  <div>
                    <div className="text-xs text-zinc-500">Daily Scroll</div>
                    <div className="text-sm font-semibold text-zinc-200">{m.mindlessMinutesAvg} min</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Revisit Rate</div>
                    <div className="text-sm font-semibold text-lime-400">{m.revisitRate}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl space-y-3">
          <Users className="w-12 h-12 mx-auto text-zinc-600" />
          <h3 className="text-lg font-semibold text-zinc-300">No Accountability Circle Joined</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create your own focus circle or join a friend's invite code to see weekly comparisons.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-lime-400 text-black font-semibold text-xs hover:bg-lime-300 transition-colors"
          >
            Create Your First Circle
          </button>
        </div>
      )}
    </div>
  );
}
