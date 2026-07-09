import React, { useEffect, useState } from 'react';
import { PlayCircle, LayoutDashboard, Save, Check, Hash, AlertCircle, Cloud, LogIn, Tag, Plus, ExternalLink, Sparkles, Clock, Film } from 'lucide-react';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { Meteors } from '../components/ui/meteors';
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
import { isChannelUrl, extractChannelId, extractYouTubeVideoId, STORAGE_KEYS } from '../shared/constants.js';
import { getCurrentUser, signInWithGoogle, signOut, isLoggedIn, getUserEmail, getUserName, getPersistedAuthState } from '../shared/auth.js';
import { supabaseClient } from '../shared/supabase.js';
import { syncWithCloud } from '../shared/sync.js';

const PLANT_EMOJI = {
  thriving: '🌿',
  okay: '🌱',
  wilting: '🥀',
  dead: '💀',
};

const PLANT_COLOR = {
  thriving: 'text-green-400 bg-green-400/10 border-green-400/20',
  okay: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  wilting: 'text-red-400 bg-red-400/10 border-red-400/20',
  dead: 'text-zinc-500 bg-zinc-800 border-zinc-700',
};

function usePopupData() {
  const [ready, setReady] = useState(false);
  const [pageInfo, setPageInfo] = useState(null);
  const [game, setGame] = useState({ plant: 'thriving', budgetMinutesTotal: 60, budgetMinutesUsed: 0 });
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [tabError, setTabError] = useState(null);

  useEffect(() => {
    initStorage().then(() => {
      const g = getGameState();
      setGame(g);
      setReady(true);

      // Get the active tab URL/title
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (chrome.runtime.lastError || !tab || !tab.url) {
            setTabError("Couldn't read the current tab. Try reopening the popup.");
            return;
          }
          const info = {
            url: tab.url,
            title: tab.title || 'Unknown Page',
            favIconUrl: tab.favIconUrl || '',
            thumbnail: null,
            author: null,
            authorUrl: null,
            contentType: null,
            platform: null,
          };
          setPageInfo(info);

          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' }, (res) => {
              if (res) {
                const liveUrl = res.url || tab.url;
                setPageInfo((prev) => prev ? {
                  ...prev,
                  url: liveUrl,
                  title: res.title || prev.title,
                  thumbnail: res.thumbnail || prev.thumbnail,
                  author: res.author || res.channel || prev.author,
                  authorUrl: res.authorUrl || null,
                  contentType: res.contentType || prev.contentType,
                  platform: res.platform || prev.platform,
                } : null);

                const queue = getQueue();
                const liveVideoId = extractYouTubeVideoId(liveUrl);
                const isSavedLive = queue.some((i) => {
                  if (i.deleted) return false;
                  if (i.url === liveUrl) return true;
                  if (liveVideoId && extractYouTubeVideoId(i.url) === liveVideoId) return true;
                  return false;
                });
                setAlreadySaved(isSavedLive);
              }
            });
          }

          // Check if already saved. Deleted items are soft-deleted
          // (kept in the queue with deleted: true so the sync engine
          // can propagate the removal) — they must be excluded here,
          // otherwise a video removed from the dashboard would show
          // as "Already Saved" forever in the popup.
          //
          // Match by normalized video id when possible so the same video
          // opened with different tracking params (t=, si=, list=, pp=)
          // isn't treated as a new, separate save.
          const queue = getQueue();
          const tabVideoId = extractYouTubeVideoId(tab.url);
          setAlreadySaved(queue.some((i) => {
            if (i.deleted) return false;
            if (i.url === tab.url) return true;
            if (tabVideoId && extractYouTubeVideoId(i.url) === tabVideoId) return true;
            return false;
          }));
        });
      } else {
        setTabError('Extension APIs unavailable in this context.');
      }
    });

    // Subscribe to game state changes (key must match STORAGE_KEYS.GAME,
    // which is what storage.js uses when it notifies subscribers)
    const unsub = subscribe(STORAGE_KEYS.GAME, (g) => setGame(g));
    return unsub;
  }, []);

  return { ready, pageInfo, game, alreadySaved, setAlreadySaved, tabError };
}

export default function PopupApp() {
  const { ready, pageInfo, game, alreadySaved, setAlreadySaved, tabError } = usePopupData();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const [transcriptStatus, setTranscriptStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [itemTags, setItemTags] = useState([]);

  useEffect(() => {
    if (pageInfo?.url) {
      const queue = getQueue();
      const tabVideoId = extractYouTubeVideoId(pageInfo.url);
      const item = queue.find(i => i.url === pageInfo.url || (tabVideoId && extractYouTubeVideoId(i.url) === tabVideoId));
      if (item && item.tags) {
        setItemTags(item.tags);
      }
    }
  }, [pageInfo, alreadySaved, saved]);

  // Subscribe to auth state changes so the popup reflects sign-in/sign-out
  // without needing a manual refresh.
  useEffect(() => {
    // 1. Recover persisted session immediately to prevent screen flickers
    getPersistedAuthState().then(({ user: persistedUser }) => {
      if (persistedUser) {
        setUser(persistedUser);
      }
    });

    // 2. Query current session in background
    getCurrentUser().then((current) => {
      if (current) {
        setUser(current);
      }
    }).catch((err) => {
      console.warn('DopaQueue: getCurrentUser failed in popup', err);
    });

    // 3. Listen to state changes
    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html?auth=true') });
      window.close();
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      const current = await getCurrentUser();
      setUser(current);
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut();
      setUser(null);
    } catch (err) {
      setAuthError(err.message || 'Sign-out failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSync = async () => {
    if (!user) {
      setSyncStatus('error');
      setAuthError('Sign in first to sync to cloud.');
      return;
    }
    setSyncing(true);
    setSyncStatus(null);
    try {
      await syncWithCloud();
      setSyncStatus('success');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      setSyncStatus('error');
      setAuthError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const isChannel = pageInfo ? isChannelUrl(pageInfo.url) : false;

  const handleSave = async () => {
    if (!pageInfo || saved || alreadySaved) return;
    setSaveError(null);
    try {
      let liveInfo = { ...pageInfo };
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        liveInfo = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab?.id) return resolve(liveInfo);
            chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' }, (res) => {
              if (res && res.url) {
                resolve({
                  url: res.url,
                  title: res.title || liveInfo.title,
                  thumbnail: res.thumbnail || liveInfo.thumbnail,
                  author: res.author || res.channel || liveInfo.author,
                  authorUrl: res.authorUrl || liveInfo.authorUrl,
                  contentType: res.contentType || liveInfo.contentType || 'video',
                  platform: res.platform || liveInfo.platform
                });
              } else {
                resolve(liveInfo);
              }
            });
          });
        });
        setPageInfo(liveInfo);
      }

      const pageVideoId = extractYouTubeVideoId(liveInfo.url);
      const existing = getQueue().find((i) =>
        i.deleted && (
          i.url === liveInfo.url ||
          (pageVideoId && extractYouTubeVideoId(i.url) === pageVideoId)
        )
      );

      if (isChannel) {
        if (existing) {
          updateQueueItem(existing.id, {
            title: extractChannelId(liveInfo.url) || liveInfo.title,
            type: 'channel',
            savedAt: Date.now(),
            deleted: false,
          });
        } else {
          addToQueue({
            id: crypto.randomUUID(),
            url: liveInfo.url,
            title: extractChannelId(liveInfo.url) || liveInfo.title,
            type: 'channel',
            savedAt: Date.now(),
          });
        }
      } else {
        if (existing) {
          updateQueueItem(existing.id, {
            url: liveInfo.url,
            title: liveInfo.title,
            thumbnail: liveInfo.thumbnail || existing.thumbnail || null,
            author: liveInfo.author || existing.author || null,
            contentType: liveInfo.contentType || existing.contentType || 'video',
            platform: liveInfo.platform || existing.platform || null,
            type: 'video',
            savedAt: Date.now(),
            watched: false,
            deleted: false,
          });
        } else {
          addToQueue({
            id: crypto.randomUUID(),
            url: liveInfo.url,
            title: liveInfo.title,
            thumbnail: liveInfo.thumbnail || null,
            author: liveInfo.author || null,
            contentType: liveInfo.contentType || 'video',
            platform: liveInfo.platform || null,
            type: 'video',
            savedAt: Date.now(),
            watched: false,
          });
        }

        if (liveInfo.author) {
          ensureChannelSaved(liveInfo.author, liveInfo.authorUrl || '', liveInfo.platform || 'Social Media');
        }

        setSaved(true);
        setAlreadySaved(true);
        setFetchingTranscript(false);
      }
    } catch (err) {
      console.error('DopaQueue: failed to save item', err);
      setSaveError('Failed to save. Please try again.');
    }
  };

  const handleAddQuickTag = (e) => {
    e.preventDefault();
    if (!tagInput.trim() || !pageInfo?.url) return;
    const cleanTag = tagInput.trim().replace(/^#/, '');
    const queue = getQueue();
    const tabVideoId = extractYouTubeVideoId(pageInfo.url);
    const item = queue.find(i => i.url === pageInfo.url || (tabVideoId && extractYouTubeVideoId(i.url) === tabVideoId));
    if (item) {
      const nextTags = Array.from(new Set([...(item.tags || []), cleanTag]));
      updateQueueItem(item.id, { tags: nextTags });
      setItemTags(nextTags);
    }
    setTagInput('');
  };

  const handleRemoveQuickTag = (tagToRemove) => {
    if (!pageInfo?.url) return;
    const queue = getQueue();
    const tabVideoId = extractYouTubeVideoId(pageInfo.url);
    const item = queue.find(i => i.url === pageInfo.url || (tabVideoId && extractYouTubeVideoId(i.url) === tabVideoId));
    if (item) {
      const nextTags = (item.tags || []).filter(t => t !== tagToRemove);
      updateQueueItem(item.id, { tags: nextTags });
      setItemTags(nextTags);
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    }
  };

  const plantStatus = game.plant || 'thriving';
  const remaining = Math.max(0, game.budgetMinutesTotal - game.budgetMinutesUsed);
  const budgetPct = Math.max(0, 100 - (game.budgetMinutesUsed / (game.budgetMinutesTotal || 60)) * 100);
  const savedVideos = getSavedVideos().slice(0, 2);
  const videoId = pageInfo?.url ? extractYouTubeVideoId(pageInfo.url) : null;
  const isShorts = pageInfo?.url && /\/shorts\//i.test(pageInfo.url);

  if (!ready) {
    return (
      <div className="w-[360px] h-[440px] flex flex-col items-center justify-center bg-[#09090b] text-zinc-400 gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-lime-400 border-t-transparent animate-spin" />
        <span className="text-xs font-medium tracking-wide">Loading DopaQueue...</span>
      </div>
    );
  }

  return (
    <div className="relative w-[360px] bg-[#09090b] text-zinc-100 flex flex-col overflow-hidden select-none border border-white/10 shadow-2xl" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Meteors number={12} />

      {/* Enterprise Header */}
      <div className="z-10 px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-sm shadow-inner">
            🌿
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">DopaQueue</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-lime-400/20 text-lime-300 border border-lime-400/30">PRO</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">Intentional Video Library</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shadow-sm ${PLANT_COLOR[plantStatus]}`}>
          <span>{PLANT_EMOJI[plantStatus]}</span>
          <span className="capitalize">{plantStatus}</span>
        </div>
      </div>

      {/* Daily Scroll Budget Indicator */}
      <div className="z-10 px-4 pt-3 pb-2 bg-gradient-to-b from-zinc-900/40 to-transparent">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-lime-400" /> Daily Budget
          </span>
          <span className="font-mono text-xs font-bold text-white">
            {remaining} <span className="text-zinc-500 font-normal">min left</span>
          </span>
        </div>
        <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-lime-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Speed Bump Banner when budget is 0 */}
      {remaining === 0 && savedVideos.length > 0 && (
        <div className="z-10 px-4 pt-2">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Budget Depleted
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Clear a saved video from your queue instead of endless scroll feeds.
            </p>
          </div>
        </div>
      )}

      {/* Hero Media / Preview Card */}
      <div className="z-10 p-4 flex flex-col gap-3">
        {tabError ? (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed">{tabError}</p>
          </div>
        ) : pageInfo ? (
          <div className="group rounded-xl bg-zinc-900/90 border border-white/10 overflow-hidden shadow-lg transition-all hover:border-white/20">
            {videoId ? (
              <div className="relative h-28 bg-zinc-950 overflow-hidden">
                <img
                  src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/30" />
                <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-lime-300">
                  {isShorts ? 'SHORT' : 'VIDEO'}
                </div>
              </div>
            ) : null}

            <div className="p-3 flex items-start gap-3">
              {!videoId && (
                pageInfo.favIconUrl ? (
                  <img src={pageInfo.favIconUrl} className="w-7 h-7 rounded-md mt-0.5 shrink-0" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                    <PlayCircle className="w-4 h-4 text-zinc-500" />
                  </div>
                )
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{pageInfo.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{pageInfo.url}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 animate-pulse h-20" />
        )}

        {/* Primary Save Action Button */}
        <ShimmerButton
          onClick={handleSave}
          disabled={alreadySaved || !pageInfo || fetchingTranscript}
          className="w-full h-11 text-sm font-semibold shadow-xl"
        >
          {alreadySaved || saved ? (
            <span className="flex items-center justify-center gap-2 text-lime-400 font-bold">
              <Check className="w-4 h-4" /> Saved to Library
            </span>
          ) : isChannel ? (
            <span className="flex items-center justify-center gap-2">
              <Hash className="w-4 h-4" /> Save Channel
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Save for Later
            </span>
          )}
        </ShimmerButton>

        {/* Inline Quick Tagging Bar (Appears when video is saved) */}
        {(saved || alreadySaved) && (
          <div className="p-3 rounded-xl bg-zinc-900/70 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-lime-400" /> Categorize Video
              </span>
              <span className="text-[10px] text-zinc-500">Press enter to tag</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {itemTags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-300 border border-lime-400/30"
                >
                  #{t}
                  <button
                    onClick={() => handleRemoveQuickTag(t)}
                    className="hover:text-white font-bold ml-0.5"
                    aria-label="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddQuickTag} className="flex gap-1.5">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Add custom tag (e.g. tech, design)..."
                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-lime-400 transition-colors"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-white/5"
              >
                + Add
              </button>
            </form>
          </div>
        )}

        {saveError && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {saveError}
          </p>
        )}

        {/* Open Dashboard Button */}
        <button
          onClick={openDashboard}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all text-xs font-semibold shadow-sm"
        >
          <LayoutDashboard className="w-4 h-4 text-lime-400" />
          Open Intentional Dashboard
          <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
        </button>

        {/* Auth & Sync Bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/5 mt-0.5">
          {isLoggedIn(user) ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Signed in</p>
                <p className="text-xs text-white truncate font-medium">{getUserEmail(user) || getUserName(user)}</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sync to cloud"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-medium transition-colors disabled:opacity-50 border border-blue-500/20"
              >
                {syncing ? (
                  <div className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                ) : (
                  <Cloud className="w-3 h-3" />
                )}
                Sync
              </button>
              <button
                onClick={handleSignOut}
                disabled={authBusy}
                title="Sign out"
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50 border border-red-500/20"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-400 font-medium flex-1">Sync library across devices</p>
              <button
                onClick={handleSignIn}
                disabled={authBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400/20 hover:bg-lime-400/30 text-lime-300 text-xs font-semibold transition-colors disabled:opacity-50 border border-lime-400/30"
              >
                {authBusy ? (
                  <div className="w-3 h-3 rounded-full border-2 border-lime-300 border-t-transparent animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                Sign in
              </button>
            </>
          )}
        </div>

        {syncStatus === 'success' && (
          <p className="text-[10px] text-lime-400 text-center font-medium">Cloud Synced ✓</p>
        )}
        {authError && (
          <p role="alert" className="text-[10px] text-red-400 text-center">{authError}</p>
        )}
      </div>
    </div>
  );
}
