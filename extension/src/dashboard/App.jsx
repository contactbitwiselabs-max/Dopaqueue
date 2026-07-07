import React, { useEffect, useState } from 'react';
import {
  PlayCircle, Hash, Settings, CloudSync, Trash2, CheckCircle,
  Clock, Download, Folder, FileText, FileSpreadsheet, LogIn, X, AlertCircle
} from 'lucide-react';
import {
  initStorage, getSavedVideos, getSavedChannels, subscribe,
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup
} from '../shared/storage.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';

// Wraps a CSV field in double quotes and doubles any embedded quotes,
// so commas/quotes/newlines inside a value can't corrupt the column
// layout (matches RFC 4180 quoting rules).
function csvField(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message }
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    initStorage().then(() => {
      setVideos(getSavedVideos());
      setChannels(getSavedChannels());
    });

    const unsubQueue = subscribe('dq_queue', () => {
      setVideos(getSavedVideos());
      setChannels(getSavedChannels());
    });

    // Check auth session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      unsubQueue();
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Auto-dismiss transient status messages after a few seconds.
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleSync = async () => {
    if (!user) {
      setStatus({ type: 'error', message: 'Please sign in first to sync data.' });
      return;
    }
    setIsSyncing(true);
    setStatus(null);
    try {
      await syncWithCloud();
      setStatus({ type: 'success', message: 'Synced successfully!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = (video, format = 'markdown') => {
    const scrape = getScrapeResult(video.url);
    if (!scrape || !scrape.transcript) {
      setStatus({
        type: 'error',
        message: 'No transcript available for this video yet. Have you watched it with the extension active?',
      });
      return;
    }

    if (format === 'markdown') {
      const md = `# ${video.title}
URL: ${video.url}
Genre: ${scrape.genre || 'Unknown'}
Channel: ${scrape.channel || 'Unknown'}

## Transcript
${scrape.transcript}
`;
      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      a.click();
    } else if (format === 'csv') {
      const header = ['Title', 'URL', 'Genre', 'Channel', 'Transcript'].map(csvField).join(',');
      const row = [video.title, video.url, scrape.genre || '', scrape.channel || '', scrape.transcript]
        .map(csvField)
        .join(',');
      const csv = `${header}\n${row}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      a.click();
    }
  };

  const handleSignIn = async (email, password) => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus({ type: 'error', message: `Login failed: ${error.message}` });
      return;
    }
    setShowSignIn(false);
    setStatus({ type: 'success', message: 'Signed in!' });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">

      {/* Sidebar */}
      <div className="w-64 bg-zinc-900/50 border-r border-white/5 p-4 flex flex-col backdrop-blur-xl">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-8 px-2">
          DopaQueue
        </h1>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<PlayCircle />} label="Saved Videos" count={videos.length} />
          <NavItem active={activeTab === 'channels'} onClick={() => setActiveTab('channels')} icon={<Hash />} label="Channels" count={channels.length} />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4">
          {!user ? (
            <button onClick={() => setShowSignIn(true)} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <LogIn className="w-4 h-4" aria-hidden="true" />
              Sign In to Sync
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              aria-busy={isSyncing}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CloudSync className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-purple-500/10 blur-[100px] pointer-events-none rounded-full" />

        {status && (
          <div
            role="status"
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${
              status.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm">{status.message}</span>
            <button
              onClick={() => setStatus(null)}
              aria-label="Dismiss message"
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showSignIn && (
          <SignInModal onSubmit={handleSignIn} onClose={() => setShowSignIn(false)} />
        )}

        <div className="max-w-6xl mx-auto relative z-10">

          {activeTab === 'videos' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Your Video Queue</h2>
              {videos.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p>No videos saved yet. Save a video using the extension!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map(video => (
                    <VideoCard key={video.id} video={video} onRemove={() => removeFromQueue(video.id)} onExport={handleExport} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'channels' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Saved Channels</h2>
              {channels.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                  <p>No channels saved. Save a channel from YouTube to organize them here.</p>
                </div>
              ) : (
                <ChannelList channels={channels} />
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Settings</h2>
              <p className="text-zinc-400">Manage your sync preferences and AI options.</p>
              {/* Settings content can be expanded later */}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function SignInModal({ onSubmit, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in to sync">
      <form onSubmit={submit} className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 relative">
        <button type="button" onClick={onClose} aria-label="Close sign-in dialog" className="absolute top-4 right-4 text-zinc-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold mb-4">Sign In to Sync</h3>

        <label className="block text-xs text-zinc-500 mb-1" htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500"
        />

        <label className="block text-xs text-zinc-500 mb-1" htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
        active
          ? 'bg-zinc-800/80 text-white shadow-lg border border-white/10'
          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon, { className: 'w-5 h-5', 'aria-hidden': 'true' })}
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
  // Try to get high-res thumbnail if it's youtube
  let thumbUrl = '';
  const ytMatch = video.url.match(/v=([^&]+)/) || video.url.match(/youtu\.be\/([^?]+)/);
  if (ytMatch) {
    thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }

  const [showExport, setShowExport] = useState(false);

  return (
    <div className="group bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
      <div className="h-40 bg-zinc-800 relative overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <PlayCircle className="w-12 h-12" aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent pointer-events-none" />

        {video.watched && (
          <div className="absolute top-3 left-3 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md">
            <CheckCircle className="w-3 h-3" aria-hidden="true" /> Watched
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-white leading-tight mb-2 line-clamp-2" title={video.title}>
          {video.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{new Date(video.savedAt).toLocaleDateString()}</span>
        </div>

        <div className="flex items-center gap-2 relative">
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 bg-white text-black text-sm font-medium py-2 rounded-xl text-center hover:bg-zinc-200 transition-colors"
          >
            Watch Now
          </a>

          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              aria-label="Export transcript"
              aria-haspopup="true"
              aria-expanded={showExport}
              title="Export Transcript"
            >
              <Download className="w-5 h-5" aria-hidden="true" />
            </button>
            {showExport && (
              <div className="absolute bottom-full right-0 mb-2 w-40 bg-zinc-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                <button onClick={() => { onExport(video, 'markdown'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileText className="w-4 h-4" aria-hidden="true"/> Markdown</button>
                <button onClick={() => { onExport(video, 'csv'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" aria-hidden="true"/> CSV</button>
              </div>
            )}
          </div>

          <button
            onClick={onRemove}
            className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 bg-zinc-800 rounded-xl transition-colors"
            aria-label="Remove from queue"
            title="Remove"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelList({ channels }) {
  // Group channels by their assigned group
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
            <div className="p-2 bg-zinc-800 rounded-lg"><Folder className="w-5 h-5 text-purple-400" aria-hidden="true" /></div>
            <h3 className="text-xl font-bold">{groupName}</h3>
            <span className="text-zinc-500 text-sm ml-auto">{items.length} channels</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(channel => (
              <div key={channel.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div>
                  <h4 className="font-semibold">{channel.title}</h4>
                  <a href={channel.url} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline mt-1 block">Visit Channel</a>
                </div>

                <select
                  aria-label={`Group for ${channel.title}`}
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
