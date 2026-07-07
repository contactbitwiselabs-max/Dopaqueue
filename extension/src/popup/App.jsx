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
} from '../shared/storage.js';
import { isChannelUrl, extractChannelId } from '../shared/constants.js';
import { getCurrentUser, signInWithGoogle } from '../shared/auth.js';

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
          const queue = getQueue();
          setAlreadySaved(queue.some((i) => i.url === tab.url && !i.deleted));
        });
      } else {
        setTabError('Extension APIs unavailable in this context.');
      }
    });

    // Subscribe to game state changes
    const unsub = subscribe('game_state', (g) => setGame(g));
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

  const isChannel = pageInfo ? isChannelUrl(pageInfo.url) : false;

  const handleSave = () => {
    if (!pageInfo || saved || alreadySaved) return;
    setSaveError(null);
    try {
      // If this URL was saved before and later soft-deleted (deleted
      // items stay in the queue so the sync engine can propagate the
      // removal), resurrect that entry instead of adding a duplicate
      // row that would pile up on every delete-then-resave cycle.
      const existing = getQueue().find((i) => i.url === pageInfo.url && i.deleted);

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

        // Trigger on-demand transcript scraping on the active tab.
        // This fires the content script's SCRAPE_NOW handler so the
        // transcript is fetched and cached immediately at save time.
        setFetchingTranscript(true);
        setTranscriptStatus('fetching');
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' }, (result) => {
                if (result?.transcript) {
                  setTranscriptStatus('success');
                } else {
                  setTranscriptStatus('failed');
                }
                setFetchingTranscript(false);
              }).catch(() => {
                // Content script may not be injected (non-YouTube pages) — that's fine
                setTranscriptStatus('failed');
                setFetchingTranscript(false);
              });
            }
          });
        } else {
          setFetchingTranscript(false);
          setTranscriptStatus('failed');
        }
      }
      setSaved(true);
      setAlreadySaved(true);
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

  if (!ready) {
    return (
      <div className="w-[360px] h-[400px] flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-[360px] bg-zinc-950 flex flex-col overflow-hidden select-none" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Meteors number={10} />

      {/* Header */}
      <div className="z-10 px-4 py-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md">
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
          DopaQueue
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
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

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
              <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
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

        {transcriptStatus === 'failed' && !alreadySaved && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-2 text-yellow-600 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Transcript not available</p>
              <p className="text-yellow-500/70 mt-0.5">Video may not have captions. You can still watch it later.</p>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
