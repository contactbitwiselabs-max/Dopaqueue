import React, { useEffect, useState } from 'react';
import { PlayCircle, LayoutDashboard, Save, Check, Hash, AlertCircle, Cloud, LogIn } from 'lucide-react';
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
          };
          setPageInfo(info);

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
  const [transcriptStatus, setTranscriptStatus] = useState(null); // 'fetching' | 'success' | 'failed' | null
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'success' | 'error' | null

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

  const handleSave = () => {
    if (!pageInfo || saved || alreadySaved) return;
    setSaveError(null);
    try {
      // If this URL was saved before and later soft-deleted (deleted
      // items stay in the queue so the sync engine can propagate the
      // removal), resurrect that entry instead of adding a duplicate
      // row that would pile up on every delete-then-resave cycle.
      // Match by exact URL or by normalized video id (ignoring volatile
      // tracking params) so re-saving the same video reuses the row.
      const pageVideoId = extractYouTubeVideoId(pageInfo.url);
      const existing = getQueue().find((i) =>
        i.deleted && (
          i.url === pageInfo.url ||
          (pageVideoId && extractYouTubeVideoId(i.url) === pageVideoId)
        )
      );

      if (isChannel) {
        if (existing) {
          updateQueueItem(existing.id, {
            title: extractChannelId(pageInfo.url) || pageInfo.title,
            type: 'channel',
            savedAt: Date.now(),
            deleted: false,
          });
        } else {
          addToQueue({
            id: crypto.randomUUID(),
            url: pageInfo.url,
            title: extractChannelId(pageInfo.url) || pageInfo.title,
            type: 'channel',
            savedAt: Date.now(),
          });
        }
      } else {
        if (existing) {
          updateQueueItem(existing.id, {
            title: pageInfo.title,
            type: 'video',
            savedAt: Date.now(),
            watched: false,
            deleted: false,
          });
        } else {
          addToQueue({
            id: crypto.randomUUID(),
            url: pageInfo.url,
            title: pageInfo.title,
            type: 'video',
            savedAt: Date.now(),
            watched: false,
          });
        }

        // Instant enterprise-grade save: update UI immediately
        setSaved(true);
        setAlreadySaved(true);
        setFetchingTranscript(false);

        // Opportunistically trigger background metadata/tag scrape
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' }, () => {
                // Ignore errors; metadata is updated opportunistically
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('DopaQueue: failed to save item', err);
      setSaveError('Failed to save. Please try again.');
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

  if (!ready) {
    return (
      <div className="w-[360px] h-[400px] flex items-center justify-center bg-[#0a0a08]">
        <div className="w-6 h-6 rounded-full border-2 border-lime-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-[360px] bg-[#0a0a08] flex flex-col overflow-hidden select-none" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Meteors number={10} />

      {/* Header */}
      <div className="z-10 px-4 py-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
          <span aria-hidden>{"\ud83c\udf3f"}</span>DopaQueue
        </h1>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${PLANT_COLOR[plantStatus]}`}>
          <span>{PLANT_EMOJI[plantStatus]}</span>
          <span className="capitalize">{plantStatus}</span>
        </div>
      </div>

      {/* Budget Bar */}
      <div className="z-10 px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">Daily Budget</span>
          <span className="text-xs text-zinc-400 font-mono">{remaining} min left</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-400 rounded-full transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Speed Bump Suggestion Banner */}
      {remaining === 0 && savedVideos.length > 0 && (
        <div className="z-10 px-4 pt-3">
          <div className="p-3 bg-gradient-to-br from-red-500/10 to-lime-500/10 border border-red-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Budget Exhausted!
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Why not clear 1-2 items from your saved queue instead of browsing new content?
            </p>
            <div className="space-y-1.5 pt-1">
              {savedVideos.map(v => (
                <a
                  key={v.id}
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 rounded-lg text-xs text-lime-300 truncate transition-colors font-medium"
                >
                  ▶ {v.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="z-10 flex-1 p-4 flex flex-col">
        {tabError ? (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-snug">{tabError}</p>
          </div>
        ) : pageInfo ? (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5 mb-4">
            {pageInfo.favIconUrl ? (
              <img src={pageInfo.favIconUrl} className="w-8 h-8 rounded mt-0.5 shrink-0" alt="" />
            ) : (
              <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                <PlayCircle className="w-4 h-4 text-zinc-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">{pageInfo.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{pageInfo.url}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5 mb-4">
            <div className="w-8 h-8 rounded bg-zinc-800 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-1/2" />
            </div>
          </div>
        )}

        <ShimmerButton
          onClick={handleSave}
          disabled={alreadySaved || !pageInfo || fetchingTranscript}
          className="w-full mb-2"
        >
          {fetchingTranscript ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-lime-400 border-t-transparent animate-spin" />
              Fetching Transcript...
            </span>
          ) : alreadySaved ? (
            <span className="flex items-center justify-center gap-2 text-green-400">
              <Check className="w-4 h-4" aria-hidden="true" /> Already Saved
            </span>
          ) : saved ? (
            <span className="flex items-center justify-center gap-2 text-green-400">
              <Check className="w-4 h-4" aria-hidden="true" /> Saved!
            </span>
          ) : isChannel ? (
            <span className="flex items-center justify-center gap-2">
              <Hash className="w-4 h-4" aria-hidden="true" /> Save Channel
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" aria-hidden="true" /> Save for Later
            </span>
          )}
        </ShimmerButton>


        {saveError && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {saveError}
          </p>
        )}

        <button
          onClick={openDashboard}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-white/8 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-sm"
        >
          <LayoutDashboard className="w-4 h-4" />
          Open Dashboard
        </button>

        {/* Auth / Sync row — compact, fits within the 360px popup width */}
        <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-900/40 border border-white/5">
          {isLoggedIn(user) ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Signed in</p>
                <p className="text-xs text-white truncate">{getUserEmail(user) || getUserName(user)}</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sync to cloud"
                aria-label="Sync to cloud"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs transition-colors disabled:opacity-50"
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
                aria-label="Sign out"
                className="px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors disabled:opacity-50"
              >
                Out
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500 flex-1">Sync to cloud</p>
              <button
                onClick={handleSignIn}
                disabled={authBusy}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-lime-400/20 hover:bg-lime-400/30 text-lime-300 text-xs transition-colors disabled:opacity-50"
              >
                {authBusy ? (
                  <div className="w-3 h-3 rounded-full border-2 border-lime-300 border-t-transparent animate-spin" />
                ) : (
                  <LogIn className="w-3 h-3" />
                )}
                Sign in
              </button>
            </>
          )}
        </div>

        {syncStatus === 'success' && (
          <p className="text-[10px] text-green-400 text-center mt-1">Synced ✓</p>
        )}
        {authError && (
          <p role="alert" className="text-[10px] text-red-400 text-center mt-1">{authError}</p>
        )}
      </div>
    </div>
  );
}
