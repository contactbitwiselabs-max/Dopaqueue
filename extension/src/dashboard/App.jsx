import React, { useEffect, useState } from 'react';
import { 
  PlayCircle, Hash, Settings, CloudSync, Trash2, CheckCircle, 
  Clock, Download, Folder, FileText, FileSpreadsheet
} from 'lucide-react';
import { 
  initStorage, getSavedVideos, getSavedChannels, subscribe, 
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup 
} from '../shared/storage.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);

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

  const handleSync = async () => {
    if (!user) return alert('Please log in first to sync data.');
    setIsSyncing(true);
    try {
      await syncWithCloud();
      alert('Synced successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to sync: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = (video, format = 'markdown') => {
    const scrape = getScrapeResult(video.url);
    if (!scrape || !scrape.transcript) {
      return alert('No transcript available for this video yet. Have you watched it with the extension active?');
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
      const csv = `Title,URL,Genre,Channel,Transcript\n"${video.title}","${video.url}","${scrape.genre || ''}","${scrape.channel || ''}","${scrape.transcript.replace(/"/g, '""')}"`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      a.click();
    }
  };

  const handleSignIn = async () => {
    // Simple popup login for supabase (needs to be configured in Supabase dashboard)
    const email = prompt('Enter your email to sign in to Supabase:');
    const password = prompt('Enter your password:');
    if (email && password) {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) alert('Login failed: ' + error.message);
    }
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
            <button onClick={handleSignIn} className="w-full text-left px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              Sign In to Sync
            </button>
          ) : (
            <button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all font-medium"
            >
              <CloudSync className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-purple-500/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          
          {activeTab === 'videos' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Your Video Queue</h2>
              {videos.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                  <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
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

function NavItem({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-zinc-800/80 text-white shadow-lg border border-white/10' 
          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
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
            <PlayCircle className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent pointer-events-none" />
        
        {video.watched && (
          <div className="absolute top-3 left-3 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md">
            <CheckCircle className="w-3 h-3" /> Watched
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-white leading-tight mb-2 line-clamp-2" title={video.title}>
          {video.title}
        </h3>
        
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Clock className="w-3.5 h-3.5" />
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
              title="Export Transcript"
            >
              <Download className="w-5 h-5" />
            </button>
            {showExport && (
              <div className="absolute bottom-full right-0 mb-2 w-40 bg-zinc-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                <button onClick={() => { onExport(video, 'markdown'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileText className="w-4 h-4"/> Markdown</button>
                <button onClick={() => { onExport(video, 'csv'); setShowExport(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> CSV</button>
              </div>
            )}
          </div>

          <button 
            onClick={onRemove}
            className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 bg-zinc-800 rounded-xl transition-colors"
            title="Remove"
          >
            <Trash2 className="w-5 h-5" />
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
            <div className="p-2 bg-zinc-800 rounded-lg"><Folder className="w-5 h-5 text-purple-400" /></div>
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
