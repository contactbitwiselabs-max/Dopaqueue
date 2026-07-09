import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PlayCircle, Hash, Settings as SettingsIcon, Trash2, CheckCircle,
  Clock, LogIn, X, AlertCircle, LogOut, RefreshCw, Film, Zap, Image,
  ChevronDown, Search, Users, ExternalLink, TrendingUp, Send,
  Timer, Pause, Play, BarChart2, FileDown, Plus, Folder, Sparkles,
  Shield, Copy, Share2
} from 'lucide-react';
import {
  initStorage, getSavedVideos, getSavedChannels, subscribe,
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup,
  getWhitelist, saveWhitelist, isWhitelistedChannel, getPomodoroState, savePomodoroState
} from '../shared/storage.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename } from '../shared/export.js';
import { generateActionChecklist, autoTagItem } from '../shared/ai.js';
import { generateSharePayload, encodeShareLink } from '../shared/share.js';
import { getMyCircle, createCircle, joinCircleByCode, getWeeklyMirrorReport } from '../shared/circles.js';
import { SHARE_BASE_URL } from '../shared/constants.js';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { DeleteIcon, SyncIcon, ExportIcon, ShareIcon as AnimShareIcon, CopyIcon, TagIcon, SparklesIcon, PlantIcon } from '../components/ui/animated-icons';
import { StaggerList, StaggerItem, PageTransition, HoverCard, FadeIn, SlideUp, PulseDot } from '../components/motion';

import Settings from './pages/Settings.jsx';
import DigitalWellbeing from './pages/DigitalWellbeing.jsx';

import type { QueueItem, Channel, StatusMessage, ContentType, UrgencyLevel, ExportFormat } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────

function detectContentType(url: string): ContentType {
  if (!url) return 'video';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  return 'video';
}

const TYPE_CONFIG = {
  video: { label: 'Video', variant: 'video' as const, icon: PlayCircle },
  short: { label: 'Short', variant: 'short' as const, icon: Zap },
  reel: { label: 'Reel', variant: 'reel' as const, icon: Film },
  post: { label: 'Post', variant: 'post' as const, icon: Image },
};

function formatDateTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

type TabId = 'videos' | 'channels' | 'analysis' | 'circles' | 'settings';

// ─── Auth Page ─────────────────────────────────────────────────────
function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabaseClient.auth.signUp({
          email, password,
          options: { emailRedirectTo: chrome.runtime.getURL('dashboard.html') },
        });
        if (signUpError) throw signUpError;
        setMessage('sent');
      } else {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthSuccess?.();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google') => {
    setError(null);
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: chrome.runtime.getURL('dashboard.html') },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--dq-bg)] text-white font-sans">
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-lime-950/40 via-zinc-950 to-emerald-950/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(163,230,53,0.15)_0%,_transparent_60%)]" />
        <FadeIn className="relative z-10 text-center px-12">
          <motion.h1 className="text-5xl font-black text-white mb-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            🌿 DopaQueue
          </motion.h1>
          <motion.p className="text-zinc-400 text-lg max-w-md leading-relaxed" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            Save videos intentionally. Watch them distraction-free. Reclaim your focus.
          </motion.p>
          <motion.div className="mt-12 flex gap-6 justify-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            {[{ icon: PlayCircle, label: 'Videos', color: 'text-lime-400' }, { icon: Zap, label: 'Shorts', color: 'text-yellow-400' }, { icon: Film, label: 'Reels', color: 'text-pink-400' }].map(({ icon: Icon, label, color }) => (
              <HoverCard key={label} className="flex flex-col items-center gap-2 text-zinc-600">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <span className="text-xs">{label}</span>
              </HoverCard>
            ))}
          </motion.div>
        </FadeIn>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <SlideUp className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
          <p className="text-zinc-500 mb-8">{mode === 'signin' ? 'Sign in to sync across devices' : 'Get started with DopaQueue'}</p>

          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleOAuth('google')}>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Email</label>
              <Input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Password</label>
              <Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </motion.div>
              )}
              {message && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-lime-400 bg-lime-500/10 border border-lime-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <CheckCircle className="w-5 h-5" /> Verify Your Email
                  </div>
                  <p className="text-zinc-300 text-xs">Check your inbox at <strong>{email}</strong>.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null); }} className="text-lime-400 hover:text-lime-300 font-medium">
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          <button onClick={onAuthSuccess} className="w-full text-center text-xs text-zinc-600 mt-4 hover:text-zinc-400 transition-colors">
            Skip for now — use offline only
          </button>
        </SlideUp>
      </div>
    </div>
  );
}

// ─── Pomodoro Bar ─────────────────────────────────────────────────
function PomodoroBar() {
  const [seconds, setSeconds] = useState(1500);
  const [active, setActive] = useState(false);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (active && seconds > 0) interval = setInterval(() => setSeconds(s => s - 1), 1000);
    else if (seconds === 0 && active) { setActive(false); alert('Focus Block completed! 🎯'); }
    return () => { if (interval) clearInterval(interval); };
  }, [active, seconds]);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = ((1500 - seconds) / 1500) * 100;

  return (
    <motion.div
      className="mb-6 p-4 glass-card flex items-center justify-between"
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-lime-500/15 border border-lime-500/25 flex items-center justify-center text-lime-400">
          <Timer className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-lime-400 mb-0.5 flex items-center gap-1.5">
            {active && <PulseDot />} Deep Focus Mode
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
        </div>
      </div>
      <div className="flex-1 mx-6 hidden sm:block">
        <Progress value={progress} className="h-1.5" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={active ? 'secondary' : 'default'} onClick={() => setActive(!active)}>
          {active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Start Focus</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setActive(false); setSeconds(1500); }}>
          Reset
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Video Card ───────────────────────────────────────────────────
interface VideoCardProps {
  video: QueueItem;
  onRemove: () => void;
  onExport: (v: QueueItem, fmt: ExportFormat) => void;
  onReadArticle: () => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onSetUrgency: (id: string, urgency: UrgencyLevel) => void;
}

function VideoCard({ video, onRemove, onExport, onReadArticle, onUpdateTags, onSetUrgency }: VideoCardProps) {
  const [copied, setCopied] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const scrape = getScrapeResult(video.url) || {};
  const type = detectContentType(video.url);
  const typeCfg = TYPE_CONFIG[type];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(video.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addTag = () => {
    const newTag = tagInput.trim().replace(/^#/, '');
    if (newTag && !(video.tags || []).includes(newTag)) {
      onUpdateTags(video.id, [...(video.tags || []), newTag]);
    }
    setTagInput(''); setShowTagInput(false);
  };

  return (
    <HoverCard className="glass-card group flex flex-col h-full border border-white/5 hover:border-lime-500/20 transition-colors duration-300">
      {/* Thumbnail */}
      <div className="relative h-36 bg-zinc-900 rounded-t-2xl overflow-hidden">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <typeCfg.icon className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2">
          <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
        </div>
        {video.urgency && video.urgency !== 'Unscheduled' && (
          <div className="absolute top-2 right-2">
            <Badge variant="warning" className="text-[10px]">{video.urgency}</Badge>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4">
        {/* Title */}
        <a href={video.url} target="_blank" rel="noreferrer" className="font-semibold text-sm text-white line-clamp-2 hover:text-lime-300 transition-colors leading-snug mb-2 flex items-start gap-1.5 group/link">
          <span className="flex-1">{video.title || 'Untitled'}</span>
          <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover/link:text-lime-400 shrink-0 mt-0.5 transition-colors" />
        </a>

        {scrape.channel && <p className="text-xs text-zinc-500 mb-3 truncate">{scrape.channel}</p>}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(video.tags || []).map(tag => (
            <button key={tag} onClick={() => onUpdateTags(video.id, (video.tags || []).filter(t => t !== tag))} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
              #{tag} ×
            </button>
          ))}
          <AnimatePresence>
            {showTagInput ? (
              <motion.form initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }} exit={{ width: 0, opacity: 0 }} onSubmit={e => { e.preventDefault(); addTag(); }} className="inline-flex">
                <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)} onBlur={addTag} className="w-full text-[10px] bg-zinc-800 border border-lime-500/30 rounded-full px-2 py-0.5 text-zinc-300 outline-none" placeholder="tag..." />
              </motion.form>
            ) : (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowTagInput(true)} className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 border-dashed text-zinc-600 hover:text-lime-400 hover:border-lime-500/30 transition-colors">
                + tag
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="text-[10px] text-zinc-600 mb-4 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDateTime(video.savedAt)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="glass" className="flex-1 gap-1.5">
                <FileDown className="w-3.5 h-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Export as</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['markdown', 'csv', 'json', 'notion'] as ExportFormat[]).map(fmt => (
                <DropdownMenuItem key={fmt} onClick={() => onExport(video, fmt)}>
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="glass" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Review deck</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['Tomorrow', 'Weekend', 'Reference', 'Unscheduled'] as UrgencyLevel[]).map(u => (
                <DropdownMenuItem key={u} onClick={() => onSetUrgency(video.id, u)}>
                  {u === video.urgency ? '✓ ' : ''}{u}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }} onClick={handleCopy} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
                  <CopyIcon copied={copied} size={14} />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy URL'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DeleteIcon size={14} className="text-zinc-600 hover:text-red-400 p-2" onClick={onRemove} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </HoverCard>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

function NavItem({ active, onClick, icon, label, count }: NavItemProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm ${
        active
          ? 'bg-lime-500/10 text-lime-300 border border-lime-500/20'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? 'text-lime-400' : 'text-zinc-500'}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      {count !== undefined && (
        <span className={`text-[10px] py-0.5 px-1.5 rounded-full font-medium ${active ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 text-zinc-600'}`}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────
function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
        active ? 'bg-lime-500/15 text-lime-300 border-lime-500/30' : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300'
      }`}
    >
      {label}
      {count != null && <span className={`text-[10px] ${active ? 'text-lime-400' : 'text-zinc-600'}`}>{count}</span>}
    </motion.button>
  );
}

// ─── Status Toast ─────────────────────────────────────────────────
function StatusToast({ status, onDismiss }: { status: StatusMessage | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {status && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl max-w-sm ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="text-sm">{status.message}</span>
          <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Article Modal ─────────────────────────────────────────────────
function ArticleModal({ video, onClose }: { video: QueueItem; onClose: () => void }) {
  const scrape = getScrapeResult(video.url) || {} as any;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white line-clamp-2">{video.title}</DialogTitle>
          <DialogDescription>{scrape.channel}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="prose prose-invert prose-sm max-w-none p-1">
            {scrape.transcript ? (
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">{scrape.transcript}</p>
            ) : (
              <div className="text-center py-12 text-zinc-600">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No transcript available yet.</p>
                <p className="text-xs mt-1">Visit the video with the extension active to generate one.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [videos, setVideos] = useState<QueueItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all');
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingVideo, setReadingVideo] = useState<QueueItem | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(() => {
    setVideos(getSavedVideos());
    setChannels(getSavedChannels());
  }, []);

  useEffect(() => {
    initStorage().then(() => { refreshData(); setAuthChecked(true); });
    const unsubQueue = subscribe('dq_queue', refreshData);
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) setShowAuth(false);
    });
    return () => { unsubQueue(); authListener.subscription.unsubscribe(); };
  }, [refreshData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(t);
  }, [status]);

  const handleDelete = (id: string) => { removeFromQueue(id); refreshData(); };
  const handleUpdateTags = (id: string, tags: string[]) => { updateQueueItem(id, { tags }); refreshData(); };
  const handleSetUrgency = (id: string, urgency: UrgencyLevel) => { updateQueueItem(id, { urgency }); refreshData(); };

  const handleSync = async () => {
    if (!user) { setShowAuth(true); return; }
    setIsSyncing(true);
    try {
      await syncWithCloud();
      refreshData();
      setStatus({ type: 'success', message: 'Synced successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => { await supabaseClient.auth.signOut(); setUser(null); };

  const handleExport = (video: QueueItem, format: ExportFormat) => {
    const scrape = getScrapeResult(video.url);
    const item = { title: video.title, url: video.url, type: detectContentType(video.url), genre: (scrape as any)?.genre || 'Unknown', channel: (scrape as any)?.channel || 'Unknown', savedAt: video.savedAt, transcript: (scrape as any)?.transcript || '', tags: video.tags || [], urgency: video.urgency };
    const handlers: Record<ExportFormat, () => [string, string, string]> = {
      markdown: () => [exportToMarkdown([item], video.title), buildExportFilename('markdown', video.title), 'text/markdown'],
      csv: () => [exportToCSV([item]), buildExportFilename('csv', video.title), 'text/csv'],
      json: () => [exportToJSON([item]), buildExportFilename('json', video.title), 'application/json'],
      notion: () => [exportToNotion([item]), buildExportFilename('markdown', `${video.title}-notion`), 'text/markdown'],
    };
    const [content, filename, mimeType] = handlers[format]();
    downloadFile(content, filename, mimeType);
  };

  const filteredVideos = videos.filter(v => {
    if (filterType !== 'all' && detectContentType(v.url) !== filterType) return false;
    if (filterUrgency !== 'all' && (v.urgency || 'Unscheduled') !== filterUrgency) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const scrape = getScrapeResult(v.url) || {} as any;
    return (v.title || '').toLowerCase().includes(q) || (v.tags || []).some(t => t.toLowerCase().includes(q)) || (scrape.transcript || '').toLowerCase().includes(q) || (scrape.channel || '').toLowerCase().includes(q);
  });

  const typeCounts = videos.reduce((acc, v) => { const t = detectContentType(v.url); acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  const urgencyCounts = videos.reduce((acc, v) => { const u = v.urgency || 'Unscheduled'; acc[u] = (acc[u] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--dq-bg)]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 rounded-full border-2 border-lime-400 border-t-transparent" />
      </div>
    );
  }

  if (showAuth) {
    return <AuthPage onAuthSuccess={async () => { const { data: { session } } = await supabaseClient.auth.getSession(); setUser(session?.user || null); setShowAuth(false); }} />;
  }

  const navItems: { id: TabId; icon: React.ReactNode; label: string; count?: number }[] = [
    { id: 'videos', icon: <PlayCircle />, label: 'Saved Videos', count: videos.length },
    { id: 'channels', icon: <Hash />, label: 'Channels', count: channels.length },
    { id: 'analysis', icon: <BarChart2 />, label: 'Analysis' },
    { id: 'circles', icon: <Users />, label: 'Focus Circles' },
    { id: 'settings', icon: <SettingsIcon />, label: 'Settings' },
  ];

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-[var(--dq-bg)] text-white overflow-hidden">

        {/* ─── Sidebar ─── */}
        <div className="w-60 shrink-0 border-r border-white/5 flex flex-col p-3 backdrop-blur-xl bg-black/20">
          <div className="px-2 py-3 mb-4">
            <motion.h1 className="text-xl font-black text-white flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400 }}>
              🌿 <span className="gradient-text">DopaQueue</span>
            </motion.h1>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map(item => (
              <NavItem key={item.id} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} icon={item.icon} label={item.label} count={item.count} />
            ))}
          </nav>

          <Separator className="my-3" />

          <div className="space-y-2">
            {!user ? (
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowAuth(true)}>
                <LogIn className="w-4 h-4" /> Sign In to Sync
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-[10px]">{user.email?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-zinc-400 truncate flex-1">{user.email}</span>
                </div>
                <Button size="sm" variant="glass" className="w-full justify-start gap-2" onClick={handleSync} disabled={isSyncing}>
                  <SyncIcon spinning={isSyncing} size={14} className={isSyncing ? 'text-lime-400' : 'text-zinc-400'} />
                  {isSyncing ? 'Syncing...' : 'Sync'}
                </Button>
                <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-zinc-500" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4" /> Sign Out
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <div className="flex-1 overflow-y-auto">
          {/* Background glow */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-lime-500/5 blur-[80px] pointer-events-none rounded-full" />

          <div className="max-w-6xl mx-auto p-8 relative">
            <PomodoroBar />

            <PageTransition tabKey={activeTab}>
              {/* ─── Videos Tab ─── */}
              {activeTab === 'videos' && (
                <div>
                  {readingVideo && <ArticleModal video={readingVideo} onClose={() => setReadingVideo(null)} />}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <SlideUp>
                      <h2 className="text-3xl font-bold">Your Video Queue</h2>
                    </SlideUp>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Search... (⌘K)"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-8"
                        />
                        <AnimatePresence>
                          {searchQuery && (
                            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                              <X className="w-4 h-4" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{filteredVideos.length} items</Badge>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-zinc-600">Type:</span>
                    <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" count={videos.length} />
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) =>
                      typeCounts[key] > 0 && <FilterChip key={key} active={filterType === key} onClick={() => setFilterType(key as ContentType)} label={cfg.label} count={typeCounts[key]} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-8">
                    <span className="text-xs text-zinc-600">Deck:</span>
                    <FilterChip active={filterUrgency === 'all'} onClick={() => setFilterUrgency('all')} label="All Decks" />
                    {(['Tomorrow', 'Weekend', 'Reference'] as UrgencyLevel[]).map(u => (
                      <FilterChip key={u} active={filterUrgency === u} onClick={() => setFilterUrgency(u)} label={u} count={urgencyCounts[u] || 0} />
                    ))}
                  </div>

                  {filteredVideos.length === 0 ? (
                    <FadeIn className="text-center py-24 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                        <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      </motion.div>
                      <p className="font-medium">{videos.length === 0 ? 'No videos saved yet.' : 'No items match your filters.'}</p>
                      <p className="text-sm mt-1 text-zinc-700">{videos.length === 0 ? 'Save a video using the extension!' : 'Try adjusting your search or filters.'}</p>
                    </FadeIn>
                  ) : (
                    <StaggerList className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredVideos.map(video => (
                        <StaggerItem key={video.id}>
                          <VideoCard
                            video={video}
                            onRemove={() => handleDelete(video.id)}
                            onExport={handleExport}
                            onReadArticle={() => setReadingVideo(video)}
                            onUpdateTags={handleUpdateTags}
                            onSetUrgency={handleSetUrgency}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  )}
                </div>
              )}

              {/* ─── Channels Tab ─── */}
              {activeTab === 'channels' && (
                <div>
                  <SlideUp><h2 className="text-3xl font-bold mb-6">Saved Channels</h2></SlideUp>
                  {channels.length === 0 ? (
                    <FadeIn className="text-center py-24 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                      <Hash className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      <p className="font-medium">No channels saved yet.</p>
                      <p className="text-sm mt-1 text-zinc-700">Save a channel from YouTube.</p>
                    </FadeIn>
                  ) : (
                    <StaggerList className="grid gap-3">
                      {channels.map(ch => (
                        <StaggerItem key={ch.id}>
                          <HoverCard className="glass-card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lime-400 font-bold">
                                {ch.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <a href={ch.url} target="_blank" rel="noreferrer" className="font-semibold text-sm hover:text-lime-300 transition-colors">{ch.name}</a>
                                <p className="text-xs text-zinc-600">{formatDateTime(ch.savedAt)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {ch.group && <Badge variant="secondary">{ch.group}</Badge>}
                              <DeleteIcon size={14} className="text-zinc-600" onClick={() => handleDelete(ch.id)} />
                            </div>
                          </HoverCard>
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  )}
                </div>
              )}

              {/* ─── Analysis Tab ─── */}
              {activeTab === 'analysis' && <DigitalWellbeing videos={videos} />}

              {/* ─── Settings Tab ─── */}
              {activeTab === 'settings' && (
                <Settings user={user} onSignOut={handleSignOut} onSync={handleSync} isSyncing={isSyncing} onStatus={setStatus} />
              )}

              {/* ─── Circles Tab ─── */}
              {activeTab === 'circles' && (
                <div>
                  <SlideUp><h2 className="text-3xl font-bold mb-6">Focus Circles</h2></SlideUp>
                  <FadeIn className="text-center py-24 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="font-medium">Coming soon.</p>
                    <p className="text-sm mt-1 text-zinc-700">Join accountability circles with friends.</p>
                  </FadeIn>
                </div>
              )}
            </PageTransition>
          </div>
        </div>

        <StatusToast status={status} onDismiss={() => setStatus(null)} />
      </div>
    </TooltipProvider>
  );
}
