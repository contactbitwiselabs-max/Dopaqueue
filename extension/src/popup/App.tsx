// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Check, AlertCircle, Cloud, LogIn, ExternalLink,
  Clock, Timer, Leaf, RefreshCw, X, Search, BookOpen, TrendingUp
} from 'lucide-react';
import {
  initStorage, getGameState, getQueue, addToQueue, updateQueueItem,
  subscribe, getSavedVideos, ensureChannelSaved, updateGameState
} from '../shared/storage.js';
import {
  isChannelUrl, extractChannelId, extractYouTubeVideoId,
  STORAGE_KEYS, getPlantStatus, PLANT_THRESHOLDS
} from '../shared/constants.js';
import { validateUrl, validateQueueItem } from '../shared/validation.js';
import { supabaseClient } from '../shared/supabase.js';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { SaveIcon, ExternalLinkIcon, PlantIcon } from '../components/ui/animated-icons';
import { SlideUp, FadeIn, HoverCard, ScaleIn, BounceButton, PulseDot } from '../components/motion';
import { ThemeToggle } from '../shared/theme';

import type { QueueItem, GameState, ContentType } from '../types';

function detectContentType(url: string): ContentType {
  if (!url) return 'video';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  return 'video';
}

const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  video: 'Video', short: 'Short', reel: 'Reel', post: 'Post'
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function formatTimeAgo(ts: number): string {
  if (!ts) return 'just now';
  const diff = (Date.now() - ts) / 1000;
  if (isNaN(diff) || diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentThumbnail, setCurrentThumbnail] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [contentType, setContentType] = useState<ContentType>('video');

  useEffect(() => {
    const init = async () => {
      await initStorage();
      setQueue(getSavedVideos());
      const gs = getGameState();
      setGameState(gs);
      setBudgetInput(gs?.budgetMinutesTotal?.toString() || '60');

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['dq_terms_accepted'], (res) => {
          setTermsAccepted(Boolean(res?.dq_terms_accepted));
        });
      } else {
        setTermsAccepted(true);
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      setUser(session?.user || null);

      // Get current tab info
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          const tab = tabs[0];
          if (tab) {
            setCurrentUrl(tab.url || '');
            setCurrentTitle(tab.title || '');
            setContentType(detectContentType(tab.url || ''));
            // Try to get thumbnail
            const videoId = tab.url ? extractYouTubeVideoId(tab.url) : null;
            if (videoId) setCurrentThumbnail(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
          }
        });
      }

      setLoading(false);
    };

    init();
    const unsub = subscribe('dq_queue', () => { 
      setQueue(getSavedVideos()); 
      const gs = getGameState();
      setGameState(gs); 
      setBudgetInput(gs?.budgetMinutesTotal?.toString() || '60');
    });
    return () => unsub();
  }, []);

  const handleUpdateBudget = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      updateGameState({ budgetMinutesTotal: num });
      setGameState(getGameState());
    }
  };

  const handleSave = async () => {
    if (!currentUrl) { setSaveStatus('error'); setErrorMsg('No URL detected.'); return; }
    const validation = validateUrl(currentUrl);
    if (!validation.valid) { setSaveStatus('error'); setErrorMsg(validation.errors[0]); return; }

    setSaveStatus('saving');
    try {
      const item: Omit<QueueItem, 'id'> = {
        url: currentUrl,
        title: currentTitle || currentUrl,
        thumbnail: currentThumbnail,
        savedAt: Date.now(),
        type: contentType,
        tags: pendingTags,
      };
      await addToQueue(item as QueueItem);
      setQueue(getSavedVideos());
      setGameState(getGameState());
      setPendingTags([]);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMsg(err.message || 'Failed to save.');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const alreadySaved = queue.some(v => v.url === currentUrl);
  const health = gameState?.health ?? 0;
  const plantStatus = health > 70 ? 'thriving' : health > 40 ? 'okay' : health > 20 ? 'wilting' : 'dead';

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !pendingTags.includes(t)) setPendingTags(prev => [...prev, t]);
    setTagInput('');
  };

  if (loading) {
    return (
      <div className="w-[380px] min-h-[480px] bg-[var(--dq-bg)] p-4 flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (termsAccepted === false) {
    return (
      <div className="w-[380px] min-h-[480px] bg-[var(--dq-bg)] text-[var(--dq-text)] p-6 flex flex-col justify-between font-sans">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-lime-400" />
            <span className="font-bold text-base">DopaQueue Consent</span>
          </div>
          <p className="text-xs text-[var(--dq-text-muted)] leading-relaxed">
            By continuing, you explicitly agree to our Terms & Privacy Policy and consent to local metadata analysis of active tabs for media categorization and dopamine budgeting.
          </p>
          <div className="bg-black/20 p-3 rounded-lg border border-[var(--dq-border)] text-[11px] text-[var(--dq-text-muted)] space-y-1.5">
            <p>• Data stays local or encrypted in your private cloud.</p>
            <p>• Zero data selling or third-party ads.</p>
            <p>• Provided "AS IS" without liability for external service issues.</p>
          </div>
        </div>
        <Button
          variant="premium"
          className="w-full font-bold text-xs py-5"
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ dq_terms_accepted: true }, () => {
                setTermsAccepted(true);
              });
            } else {
              setTermsAccepted(true);
            }
          }}
        >
          I Agree & Continue
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-[380px] min-h-[480px] max-h-[600px] bg-[var(--dq-bg)] text-[var(--dq-text)] flex flex-col overflow-hidden font-sans">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--dq-border)] flex items-center justify-between">
          <motion.div className="flex items-center gap-2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Leaf className="w-5 h-5 text-lime-500" />
            <span className="font-black text-base gradient-text">DopaQueue</span>
          </motion.div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <HoverCard>
                  <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--dq-surface)] border border-[var(--dq-border)] cursor-default">
                    <PlantIcon health={health} size={12} />
                    <span className="text-[10px] font-semibold" style={{ color: health > 70 ? '#86efac' : health > 40 ? '#fde68a' : '#6b7280' }}>{health}%</span>
                  </div>
                </HoverCard>
              </TooltipTrigger>
              <TooltipContent>Plant health — {plantStatus}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 flex items-center gap-1" onClick={() => chrome?.tabs?.create({ url: chrome.runtime.getURL('dashboard.html') })}>
                  <LayoutDashboard className="w-3.5 h-3.5 text-[var(--dq-text-muted)]" />
                  <span className="text-[10px] text-[var(--dq-text-muted)] font-medium">Dashboard</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Dashboard</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Current page preview */}
          <ScaleIn>
            <div className="glass-card overflow-hidden">
              {currentThumbnail && (
                <div className="relative h-28 overflow-hidden">
                  <img src={currentThumbnail} alt={currentTitle} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <Badge variant={contentType as any} className="text-[10px]">{CONTENT_TYPE_LABEL[contentType]}</Badge>
                  </div>
                  {alreadySaved && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="success" className="text-[10px]">✓ Saved</Badge>
                    </div>
                  )}
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-semibold text-[var(--dq-text)] line-clamp-2 leading-snug mb-1">
                  {currentTitle || 'No title detected'}
                </p>
                <p className="text-[10px] text-[var(--dq-text-muted)] truncate">{currentUrl || 'No page detected'}</p>
              </div>
            </div>
          </ScaleIn>

          {/* Tags input */}
          <SlideUp delay={0.05}>
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <AnimatePresence>
                  {pendingTags.map(tag => (
                    <motion.button
                      key={tag}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={() => setPendingTags(prev => prev.filter(t => t !== tag))}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/25 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      #{tag} ×
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <Input
                  leftIcon={<span className="text-[var(--dq-text-muted)] text-xs">#</span>}
                  placeholder="Add tag and press Enter..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  className="text-xs h-8"
                />
                <Button size="sm" variant="ghost" onClick={addTag} className="shrink-0 h-8 px-3">Add</Button>
              </div>
            </div>
          </SlideUp>

          {/* Save button */}
          <SlideUp delay={0.1}>
            <AnimatePresence mode="wait">
              {saveStatus === 'saved' ? (
                <motion.div
                  key="saved"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold"
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                    <Check className="w-5 h-5" />
                  </motion.div>
                  Saved to Queue!
                </motion.div>
              ) : saveStatus === 'error' ? (
                <motion.div
                  key="error"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-2 h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 text-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                </motion.div>
              ) : (
                <motion.div key="save">
                  <Button
                    className="w-full h-11 text-sm gap-2"
                    variant={alreadySaved ? 'secondary' : 'premium'}
                    onClick={handleSave}
                    loading={saveStatus === 'saving'}
                    disabled={saveStatus === 'saving' || !currentUrl}
                  >
                    {!alreadySaved && <SaveIcon size={16} />}
                    {alreadySaved ? '✓ Already Saved' : 'Save to Queue'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </SlideUp>

          {/* Plant Health */}
          <SlideUp delay={0.15}>
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlantIcon health={health} size={16} />
                  <span className="text-xs font-semibold text-[var(--dq-text-muted)]">Your Focus Plant</span>
                </div>
                <span className="text-xs text-[var(--dq-text-muted)]">{gameState?.streak ?? 0} day streak 🔥</span>
              </div>
              <Progress value={health} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-[var(--dq-text-subtle)] items-center">
                <span>Saved today: {gameState?.savedToday ?? 0}</span>
                <div className="flex items-center gap-1.5">
                  <span>Limit (mins):</span>
                  <Input 
                    type="number" 
                    value={budgetInput} 
                    onChange={(e) => {
                      setBudgetInput(e.target.value);
                      handleUpdateBudget(e.target.value);
                    }}
                    className="h-5 w-12 text-[10px] px-1 py-0 text-center bg-[var(--dq-surface)]"
                  />
                </div>
                <span>XP: {gameState?.xp ?? 0}</span>
              </div>
            </div>
          </SlideUp>

          {/* Recent queue */}
          <SlideUp delay={0.2}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--dq-text-muted)] uppercase tracking-wider">Recently Saved</span>
                <span className="text-[10px] text-[var(--dq-text-subtle)]">{queue.length} total</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {queue.slice(0, 4).map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--dq-surface)]/50 border border-[var(--dq-border)]/50 hover:border-[var(--dq-lime-border)] hover:bg-[var(--dq-surface)] transition-colors group"
                    >
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-9 h-6 rounded object-cover shrink-0 bg-[var(--dq-surface)]" />
                      ) : (
                        <div className="w-9 h-6 rounded bg-[var(--dq-surface)] shrink-0 flex items-center justify-center text-[var(--dq-text-muted)] text-[8px]">
                          {detectContentType(item.url).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-[var(--dq-text-subtle)] truncate">{item.title}</p>
                        <p className="text-[9px] text-[var(--dq-text-muted)]">{formatTimeAgo(item.savedAt)}</p>
                      </div>
                      <ExternalLinkIcon size={12} className="text-[var(--dq-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => chrome.tabs?.create({ url: item.url })} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {queue.length === 0 && (
                  <div className="text-center py-4 text-[var(--dq-text-muted)] text-xs">
                    No videos saved yet
                  </div>
                )}
              </div>
            </div>
          </SlideUp>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--dq-border)] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <PulseDot color="#84cc16" size={6} />
                <span className="text-[10px] text-[var(--dq-text-muted)] truncate max-w-[140px]">{user.email}</span>
              </>
            ) : (
              <button onClick={() => chrome?.tabs?.create({ url: chrome.runtime.getURL('dashboard.html') + '?auth=true' })} className="text-[10px] text-[var(--dq-text-muted)] hover:text-lime-400 flex items-center gap-1 transition-colors">
                <LogIn className="w-3 h-3" /> Sign in to sync
              </button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}


