import React, { useEffect, useState } from 'react';
import { PlayCircle, LayoutDashboard, Save, Check, Leaf } from 'lucide-react';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { Meteors } from '../components/ui/meteors';
import {
  initStorage,
  getGameState,
  getQueue,
  addToQueue,
  subscribe,
} from '../shared/storage.js';

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

  useEffect(() => {
    initStorage().then(() => {
      const g = getGameState();
      setGame(g);
      setReady(true);

      // Get the active tab URL/title
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (!tab) return;
          const info = {
            url: tab.url || '',
            title: tab.title || 'Unknown Page',
            favIconUrl: tab.favIconUrl || '',
          };
          setPageInfo(info);

          // Check if already saved
          const queue = getQueue();
          setAlreadySaved(queue.some((i) => i.url === tab.url));
        });
      }
    });

    // Subscribe to game state changes
    const unsub = subscribe('game_state', (g) => setGame(g));
    return unsub;
  }, []);

  return { ready, pageInfo, game, alreadySaved, setAlreadySaved };
}

export default function PopupApp() {
  const { ready, pageInfo, game, alreadySaved, setAlreadySaved } = usePopupData();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!pageInfo || saved || alreadySaved) return;
    addToQueue({
      id: crypto.randomUUID(),
      url: pageInfo.url,
      title: pageInfo.title,
      type: 'video',
      savedAt: Date.now(),
      watched: false,
    });
    setSaved(true);
    setAlreadySaved(true);
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
        {pageInfo ? (
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
          disabled={alreadySaved}
          className="w-full mb-2"
        >
          {alreadySaved ? (
            <span className="flex items-center justify-center gap-2 text-green-400">
              <Check className="w-4 h-4" /> Already Saved
            </span>
          ) : saved ? (
            <span className="flex items-center justify-center gap-2 text-green-400">
              <Check className="w-4 h-4" /> Saved!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Save for Later
            </span>
          )}
        </ShimmerButton>

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
