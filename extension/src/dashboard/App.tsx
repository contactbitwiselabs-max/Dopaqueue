// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PlayCircle, Hash, Settings as SettingsIcon, Trash2, CheckCircle,
  Clock, LogIn, X, AlertCircle, LogOut, RefreshCw, Film, Zap, Image,
  ChevronDown, Search, Users, ExternalLink, TrendingUp, Send,
  Timer, Pause, Play, BarChart2, FileDown, Plus, Folder, Sparkles,
  Shield, Copy, Share2, Leaf, Edit2, FileText
} from 'lucide-react';
import {
  initStorage, getSavedVideos, getSavedChannels, subscribe,
  removeFromQueue, updateQueueItem, getScrapeResult, updateChannelGroup,
  getWhitelist, saveWhitelist, isWhitelistedChannel, getPomodoroState, savePomodoroState
} from '../shared/storage.js';
import { ThemeToggle } from '../shared/theme.js';
import { syncWithCloud } from '../shared/sync.js';
import { supabaseClient } from '../shared/supabase.js';
import { signInWithGoogle } from '../shared/auth.js';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename } from '../shared/export.js';
import { generateActionChecklist, autoTagItem } from '../shared/ai.js';
import { generateSharePayload, encodeShareLink } from '../shared/share.js';
import { getMyCircle, createCircle, joinCircleByCode, getWeeklyMirrorReport } from '../shared/circles.js';
import { SHARE_BASE_URL, resolveThumbnailUrl } from '../shared/constants.js';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { DeleteIcon, SyncIcon, ExportIcon, ShareIcon as AnimShareIcon, CopyIcon, TagIcon, SparklesIcon, PlantIcon } from '../components/ui/animated-icons';
import { StaggerList, StaggerItem, PageTransition, HoverCard, FadeIn, SlideUp, PulseDot } from '../components/motion';

import Settings from './pages/Settings.jsx';
import DigitalWellbeing from './pages/DigitalWellbeing.jsx';

import type { QueueItem, Channel, StatusMessage, ContentType, UrgencyLevel, ExportFormat } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────â”€

function detectContentType(url: string): ContentType {
  if (!url) return 'video';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  if (/twitter\.com/i.test(url) || /x\.com/i.test(url) || /reddit\.com/i.test(url) || /linkedin\.com/i.test(url)) return 'post';
  return 'video';
}

const TYPE_CONFIG = {
  video: { label: 'Video', variant: 'video' as const, icon: PlayCircle },
  short: { label: 'Short', variant: 'short' as const, icon: Zap },
  reel: { label: 'Reel', variant: 'reel' as const, icon: Film },
  post: { label: 'Post', variant: 'post' as const, icon: Image },
};

function formatDateTime(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

type TabId = 'videos' | 'channels' | 'analysis' | 'circles' | 'settings';

// ─── Auth Page ───────────────────────────────────────────────────â”€â”€
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
      if (provider === 'google') {
        await signInWithGoogle();
        onAuthSuccess?.();
      } else {
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider,
          options: { redirectTo: chrome.runtime.getURL('dashboard.html') },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--dq-bg)] text-[var(--dq-text)] font-sans">
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-lime-950/40 via-zinc-950 to-emerald-950/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(163,230,53,0.15)_0%,_transparent_60%)]" />
        <FadeIn className="relative z-10 text-center px-12">
          <motion.h1 className="text-5xl font-black text-[var(--dq-text)] mb-4" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            🌱 DopaQueue
          </motion.h1>
          <motion.p className="text-[var(--dq-text-muted)] text-lg max-w-md leading-relaxed" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            Save videos intentionally. Watch them distraction-free. Reclaim your focus.
          </motion.p>
          <motion.div className="mt-12 flex gap-6 justify-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            {[{ icon: PlayCircle, label: 'Videos', color: 'text-lime-400' }, { icon: Zap, label: 'Shorts', color: 'text-yellow-400' }, { icon: Film, label: 'Reels', color: 'text-pink-400' }].map(({ icon: Icon, label, color }) => (
              <HoverCard key={label} className="flex flex-col items-center gap-2 text-[var(--dq-text-muted)]">
                <div className="w-12 h-12 rounded-xl bg-[var(--dq-surface)] flex items-center justify-center border border-[var(--dq-border)]">
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
          <p className="text-[var(--dq-text-muted)] mb-8">{mode === 'signin' ? 'Sign in to sync across devices' : 'Get started with DopaQueue'}</p>

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
            <div className="flex-1 h-px bg-[var(--dq-surface)]" />
            <span className="text-xs text-[var(--dq-text-muted)] uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-[var(--dq-surface)]" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--dq-text-muted)] mb-1.5 font-medium">Email</label>
              <Input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs text-[var(--dq-text-muted)] mb-1.5 font-medium">Password</label>
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
                  <p className="text-[var(--dq-text-subtle)] text-xs">Check your inbox at <strong>{email}</strong>.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--dq-text-muted)] mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null); }} className="text-lime-400 hover:text-lime-300 font-medium">
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          <button onClick={onAuthSuccess} className="w-full text-center text-xs text-[var(--dq-text-muted)] mt-4 hover:text-[var(--dq-text-muted)] transition-colors">
            Skip for now — use offline only
          </button>
        </SlideUp>
      </div>
    </div>
  );
}

// ─── Pomodoro Bar ────────────────────────────────────────────────â”€
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
          <div className="text-sm font-bold text-[var(--dq-text)] font-mono">
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

// ─── Smart Thumbnail ────────────────────────────────────────────────
function SmartThumbnail({ video, typeCfg }: { video: QueueItem; typeCfg?: any }) {
  const [imgError, setImgError] = useState(false);
  const resolvedUrl = resolveThumbnailUrl(video.url, video.thumbnail);
  const FallbackIcon = typeCfg?.icon || PlayCircle;

  if (!resolvedUrl || imgError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--dq-text-subtle)]">
        <FallbackIcon className="w-8 h-8" />
      </div>
    );
  }

  return (
    <>
      <img
        src={resolvedUrl}
        alt={video.title}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </>
  );
}

// ─── Video Card ───────────────────────────────────────────────────
interface VideoCardProps {
  video: QueueItem;
  onRemove: () => void;
  onExport: (video: QueueItem, fmt: ExportFormat) => void;
  onReadArticle: () => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateTranscript: (id: string, transcript: string) => void;
  onSetUrgency: (id: string, urgency: UrgencyLevel) => void;
  scrapeVersion?: number; // bumped when scrape cache updates to force re-render
}

function VideoCard({ video, onRemove, onExport, onReadArticle, onUpdateTags, onUpdateNotes, onUpdateTranscript, onSetUrgency, scrapeVersion: _sv }: VideoCardProps) {
  const [copied, setCopied] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [noteText, setNoteText] = useState(video.note || video.notes || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const scrape = getScrapeResult(video.url) || {};
  const [transcriptText, setTranscriptText] = useState(video.transcript || scrape.transcript || '');
  const type = detectContentType(video.url);
  const typeCfg = (type && (TYPE_CONFIG as any)[type]) ? (TYPE_CONFIG as any)[type] : TYPE_CONFIG.video;

  const handleTranscriptSave = () => {
    setIsEditingTranscript(false);
    if (transcriptText.trim() !== (video.transcript || '')) {
      onUpdateTranscript(video.id, transcriptText.trim());
    }
  };

  const renderTranscript = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => 
      urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-lime-400 hover:underline break-all">{part}</a> : part
    );
  };

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

  const handleNoteBlur = () => {
    setIsEditingNote(false);
    if (noteText.trim() !== (video.note || video.notes || '')) {
      onUpdateNotes(video.id, noteText.trim());
    }
  };

  return (
    <HoverCard className="glass-card group flex flex-col h-full border border-[var(--dq-border)] hover:border-lime-500/20 transition-colors duration-300">
      {/* Thumbnail */}
      <div className="relative h-36 bg-[var(--dq-surface)] rounded-t-2xl overflow-hidden">
        <SmartThumbnail video={video} typeCfg={typeCfg} />
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
          {(scrape.platform || (video as any).platform) && (
            <Badge variant="glass" className="bg-black/50 text-white backdrop-blur-md">{(scrape.platform || (video as any).platform)}</Badge>
          )}
        </div>
        {video.urgency && video.urgency !== 'Unscheduled' && (
          <div className="absolute top-2 right-2">
            <Badge variant="warning" className="text-[10px]">{video.urgency}</Badge>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4">
        {/* Title */}
        <a href={video.url} target="_blank" rel="noreferrer" className="font-semibold text-sm text-[var(--dq-text)] line-clamp-2 hover:text-lime-300 transition-colors leading-snug mb-2 flex items-start gap-1.5 group/link">
          <span className="flex-1">{video.title || 'Untitled'}</span>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--dq-text-muted)] group-hover/link:text-lime-400 shrink-0 mt-0.5 transition-colors" />
        </a>

        {scrape.channel && <p className="text-xs text-[var(--dq-text-muted)] mb-3 truncate">{scrape.channel}</p>}

        {/* Tags */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {(video.tags || []).map(tag => (
              <button key={tag} onClick={() => onUpdateTags(video.id, (video.tags || []).filter(t => t !== tag))} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--dq-surface)] text-[var(--dq-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                #{tag} &times;
              </button>
            ))}
            <AnimatePresence>
              {showTagInput ? (
                <motion.form initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }} exit={{ width: 0, opacity: 0 }} onSubmit={e => { e.preventDefault(); addTag(); }} className="inline-flex">
                  <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)} onBlur={addTag} className="w-full text-[10px] bg-[var(--dq-surface)] border border-lime-500/30 rounded-full px-2 py-0.5 text-[var(--dq-text-subtle)] outline-none" placeholder="tag..." />
                </motion.form>
              ) : (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowTagInput(true)} className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 border-dashed text-[var(--dq-text-muted)] hover:text-lime-400 hover:border-lime-500/30 transition-colors">
                  + tag
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          
          {/* Auto-detected tags */}
          {scrape.scrapedTags && scrape.scrapedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {scrape.scrapedTags.map((tag: string) => {
                const already = (video.tags || []).includes(tag);
                if (already) return null;
                return (
                  <button
                    key={'auto-' + tag}
                    type="button"
                    onClick={() => onUpdateTags(video.id, [...(video.tags || []), tag])}
                    className="text-[9px] px-1.5 py-0.5 rounded border bg-transparent text-[var(--dq-text-subtle)] border-white/10 hover:bg-lime-500/10 hover:text-lime-400 hover:border-lime-500/20 transition-colors"
                  >
                    +#{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-3">
          {isEditingNote ? (
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add your thoughts here..."
              className="w-full text-xs bg-[var(--dq-surface)] border border-lime-500/30 rounded p-2 text-[var(--dq-text)] outline-none resize-none min-h-[60px]"
            />
          ) : (
            <div 
              onClick={() => setIsEditingNote(true)}
              className="text-xs p-2 rounded bg-black/10 border border-transparent hover:border-lime-500/20 cursor-pointer text-[var(--dq-text-muted)] min-h-[36px] flex items-start gap-2 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
              <span className={noteText ? "text-[var(--dq-text)] whitespace-pre-wrap" : "italic opacity-50"}>
                {noteText || "Add a note..."}
              </span>
            </div>
          )}
        </div>

        <div className="text-[10px] text-[var(--dq-text-muted)] mb-4 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDateTime(video.savedAt)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <Button size="xs" variant="glass" className="flex-1 gap-1.5" onClick={() => setShowTranscript(true)}>
            <FileText className="w-3.5 h-3.5" /> Content
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="glass" className="gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
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
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }} onClick={handleCopy} className="p-2 rounded-lg text-[var(--dq-text-muted)] hover:text-[var(--dq-text-subtle)] transition-colors">
                  <CopyIcon copied={copied} size={14} />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy URL'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onRemove} className="p-2 rounded-lg text-[var(--dq-text-muted)] hover:text-red-400 transition-colors flex items-center justify-center">
                  <DeleteIcon size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Transcript Dialog */}
      <Dialog open={showTranscript} onOpenChange={setShowTranscript}>
        <DialogContent className="sm:max-w-[600px] bg-[#111] border-zinc-800 max-h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Content / Transcript</DialogTitle>
            <DialogDescription className="text-zinc-400">
              View or manually save content here. (BYOK AI automation coming soon!)
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {isEditingTranscript ? (
              <textarea
                autoFocus
                value={transcriptText}
                onChange={e => setTranscriptText(e.target.value)}
                onBlur={handleTranscriptSave}
                placeholder="Paste transcript or post content here..."
                className="w-full min-h-[300px] text-sm bg-black/40 border border-lime-500/30 rounded-xl p-4 text-white outline-none resize-none focus:border-lime-500/50 transition-colors"
              />
            ) : (
              <div 
                className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-[200px]"
                onDoubleClick={() => setIsEditingTranscript(true)}
              >
                {transcriptText ? renderTranscript(transcriptText) : (
                  <div className="italic text-zinc-500 text-center py-16 border border-dashed border-zinc-700 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsEditingTranscript(true)}>
                    No content saved yet. Click here to add.
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-800">
            {!isEditingTranscript && (
              <Button variant="glass" onClick={() => setIsEditingTranscript(true)}>
                <Edit2 className="w-4 h-4 mr-2" /> Edit
              </Button>
            )}
            {isEditingTranscript && (
              <Button className="bg-lime-500 text-black hover:bg-lime-600" onClick={handleTranscriptSave}>
                Save Changes
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </HoverCard>
  );
}

// ─── Nav Item ───────────────────────────────────────────────────â”€â”€
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
          ? 'bg-lime-500/10 text-lime-600 dark:text-lime-300 border border-lime-500/20'
          : 'text-[var(--dq-text-muted)] hover:text-[var(--dq-text-subtle)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? 'text-lime-500 dark:text-lime-400' : 'text-[var(--dq-text-muted)]'}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      {count !== undefined && (
        <span className={`text-[10px] py-0.5 px-1.5 rounded-full font-medium ${active ? 'bg-lime-500/20 text-lime-400' : 'bg-[var(--dq-surface)] text-[var(--dq-text-muted)]'}`}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

// ─── Filter Chip ────────────────────────────────────────────────â”€â”€
function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
        active ? 'bg-lime-500/15 text-lime-300 border-lime-500/30' : 'bg-[var(--dq-surface)]/50 text-[var(--dq-text-muted)] border-[var(--dq-border)] hover:text-[var(--dq-text-subtle)]'
      }`}
    >
      {label}
      {count != null && <span className={`text-[10px] ${active ? 'text-lime-400' : 'text-[var(--dq-text-muted)]'}`}>{count}</span>}
    </motion.button>
  );
}

// ─── Status Toast ────────────────────────────────────────────────â”€
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

// ─── Article Modal ────────────────────────────────────────────────â”€
function ArticleModal({ video, onClose }: { video: QueueItem; onClose: () => void }) {
  const scrape = getScrapeResult(video.url) || {} as any;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[var(--dq-text)] line-clamp-2">{video.title}</DialogTitle>
          <DialogDescription>{scrape.channel}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="prose prose-invert prose-sm max-w-none p-1">
            {scrape.transcript ? (
              <p className="text-[var(--dq-text-subtle)] leading-relaxed whitespace-pre-wrap text-sm">{scrape.transcript}</p>
            ) : (
              <div className="text-center py-12 text-[var(--dq-text-muted)]">
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
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'settings' || tab === 'channels' || tab === 'analysis' || tab === 'circles' || tab === 'videos') {
        return tab;
      }
    }
    return 'videos';
  });
  const [videos, setVideos] = useState<QueueItem[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auth') === 'true';
  });
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all');
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [readingVideo, setReadingVideo] = useState<QueueItem | null>(null);
  const [scrapeVersion, setScrapeVersion] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(() => {
    const savedVideos = getSavedVideos();
    setVideos(savedVideos);

    // Derive unique channels from saved videos via scrape cache
    const channelMap = new Map<string, { name: string; url: string; videoCount: number; savedAt: number; authorImage: string | null; platform: string | null }>();
    savedVideos.forEach(v => {
      const scrape = getScrapeResult(v.url) || {} as any;
      const name = scrape.channel || v.channel || v.channelName || v.author || null;
      const authorUrl = scrape.authorUrl || v.authorUrl || '';
      const authorImage = scrape.authorImage || null;
      const platform = scrape.platform || v.platform || detectContentType(v.url) || null;
      if (!name) return;
      const key = name.toLowerCase();
      if (channelMap.has(key)) {
        const existing = channelMap.get(key)!;
        existing.videoCount++;
        if ((v.savedAt as number) > existing.savedAt) existing.savedAt = v.savedAt as number;
        if (!existing.authorImage && authorImage) existing.authorImage = authorImage;
      } else {
        channelMap.set(key, { name, url: authorUrl, videoCount: 1, savedAt: v.savedAt as number, authorImage, platform });
      }
    });
    const derivedChannels: Channel[] = Array.from(channelMap.entries()).map(([key, val]) => ({
      id: key,
      name: val.name,
      url: val.url,
      savedAt: val.savedAt,
      videoCount: val.videoCount,
      authorImage: val.authorImage,
      platform: val.platform
    } as any));
    setChannels(derivedChannels.sort((a: any, b: any) => b.videoCount - a.videoCount));
  }, []);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['dq_terms_accepted'], (res) => {
        setTermsAccepted(Boolean(res?.dq_terms_accepted));
      });
    } else {
      setTermsAccepted(true);
    }
    initStorage().then(() => { refreshData(); setAuthChecked(true); });
    const unsubQueue = subscribe('dq_queue', refreshData);
    // Bump version counter when scrape cache updates so VideoCards re-read getScrapeResult
    // Using a separate counter (not refreshData) avoids stale-queue race conditions
    const unsubScrape = subscribe('dq_scrape_cache', () => setScrapeVersion(v => v + 1));
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) setShowAuth(false);
    });
    return () => { unsubQueue(); unsubScrape(); authListener.subscription.unsubscribe(); };
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
  const handleUpdateNotes = (id: string, notes: string) => { updateQueueItem(id, { notes }); refreshData(); };
  const handleUpdateTranscript = (id: string, transcript: string) => { updateQueueItem(id, { transcript }); refreshData(); };
  const handleSetUrgency = (id: string, urgency: UrgencyLevel) => {
    updateQueueItem(id, { urgency });
    setVideos(prev => prev.map(v => v.id === id ? { ...v, urgency } : v));
    refreshData();
  };

  const handleSync = async () => {
    if (!user) { setShowAuth(true); return; }
    setIsSyncing(true);
    setSyncFeedback('idle');
    try {
      await syncWithCloud();
      refreshData();
      setSyncFeedback('success');
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(nowStr);
      setStatus({ type: 'success', message: 'Synced successfully with cloud!' });
      setTimeout(() => setSyncFeedback('idle'), 4000);
    } catch (err: any) {
      setSyncFeedback('error');
      setStatus({ type: 'error', message: `Sync failed: ${err.message}` });
      setTimeout(() => setSyncFeedback('idle'), 4000);
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
    const queryTerms = q.split(/\s+/).filter(Boolean);
    const scrape = getScrapeResult(v.url) || {} as any;
    
    return queryTerms.every(term => {
      if (term.startsWith('#') && term.length > 1) {
        const tagQuery = term.slice(1);
        return (v.tags || []).some(t => t.toLowerCase().includes(tagQuery));
      }

      const searchTarget = [
        v.title,
        ...(v.tags || []),
        scrape.transcript,
        scrape.channel,
        v.channel,
        v.channelName,
        v.author,
        v.note,
        v.notes
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchTarget.includes(term);
    });
  }).sort((a, b) => {
    const ta = typeof a.savedAt === 'string' ? new Date(a.savedAt).getTime() : (a.savedAt || 0);
    const tb = typeof b.savedAt === 'string' ? new Date(b.savedAt).getTime() : (b.savedAt || 0);
    return sortOrder === 'newest' ? tb - ta : ta - tb;
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

  if (termsAccepted === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--dq-bg)] p-6 text-[var(--dq-text)] overflow-hidden">
        <div className="max-w-xl w-full bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-2xl p-8 shadow-2xl backdrop-blur-2xl flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center text-lime-400 shrink-0">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Welcome to DopaQueue</h1>
              <p className="text-xs text-[var(--dq-text-muted)]">Terms & Conditions, Privacy Policy & Data Consent</p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4 text-xs text-[var(--dq-text-muted)] space-y-3 max-h-64 overflow-y-auto border border-[var(--dq-border)]">
            <p className="font-semibold text-[var(--dq-text)]">1. Consent to Content & Metadata Analysis</p>
            <p>By using DopaQueue, you explicitly consent to allowing the extension to inspect active tab metadata (page URLs, titles, timestamps, and estimated consumption durations) on supported media platforms solely for dopamine budgeting, media categorization, and watch analytics.</p>

            <p className="font-semibold text-[var(--dq-text)]">2. Local-First & Zero Data Selling</p>
            <p>Your queue and watch data stay locally on your device unless you actively enable Google Cloud Sync. We never sell, share, or broker your personal data or browsing history to advertisers.</p>

            <p className="font-semibold text-[var(--dq-text)]">3. Limitation of Liability ("AS IS")</p>
            <p>DopaQueue is provided "AS IS" without warranties of any kind. You agree that the developer and publisher shall not be held liable for any direct or indirect damages, cloud sync interruptions, or data security incidents related to third-party infrastructure (e.g. Supabase, Google OAuth).</p>
          </div>

          <Button
            variant="premium"
            className="w-full py-6 font-bold text-sm"
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
            I Agree to Terms & Privacy Policy — Continue
          </Button>
        </div>
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
      <div className="flex h-screen bg-[var(--dq-bg)] text-[var(--dq-text)] overflow-hidden">

        {/* ─── Sidebar ─── */}
        <div className="w-60 shrink-0 border-r border-[var(--dq-border)] flex flex-col p-3 backdrop-blur-xl bg-[var(--dq-surface)] dark:bg-black/20">
          <div className="px-2 py-3 mb-4">
            <motion.h1 className="text-xl font-black text-[var(--dq-text)] flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400 }}>
              <Leaf className="w-6 h-6 text-lime-500" /> <span className="gradient-text">DopaQueue</span>
            </motion.h1>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map(item => (
              <NavItem key={item.id} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} icon={item.icon} label={item.label} count={item.count} />
            ))}
          </nav>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold text-[var(--dq-text-muted)] uppercase tracking-wider">Theme</span>
              <ThemeToggle />
            </div>
            {!user ? (
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowAuth(true)}>
                <LogIn className="w-4 h-4" /> Sign In to Sync
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt={user.email} />
                    <AvatarFallback className="text-[10px]">{user.email?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-[var(--dq-text-muted)] truncate flex-1">{user.email}</span>
                </div>
                <Button
                  size="sm"
                  variant={syncFeedback === 'success' ? 'premium' : syncFeedback === 'error' ? 'destructive' : 'glass'}
                  className={`w-full justify-start gap-2 transition-all duration-300 ${
                    syncFeedback === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold' : ''
                  }`}
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <SyncIcon spinning={true} size={14} className="text-lime-400" />
                      <span>Syncing...</span>
                    </>
                  ) : syncFeedback === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Synced ✓</span>
                    </>
                  ) : syncFeedback === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Sync Failed</span>
                    </>
                  ) : (
                    <>
                      <SyncIcon spinning={false} size={14} className="text-[var(--dq-text-muted)]" />
                      <span>Sync Cloud</span>
                    </>
                  )}
                </Button>
                {lastSyncedTime && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Last synced at {lastSyncedTime}
                  </div>
                )}
                <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-[var(--dq-text-muted)]" onClick={handleSignOut}>
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
                      <div className="relative flex-1 sm:max-w-xs">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dq-text-muted)] pointer-events-none" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Search... (Cmd+K)"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-8"
                        />
                        <AnimatePresence>
                          {searchQuery && (
                            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dq-text-muted)] hover:text-[var(--dq-text)]">
                              <X className="w-4 h-4" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--dq-border)] text-[var(--dq-text-muted)] hover:text-[var(--dq-text)] hover:border-[var(--dq-text-muted)] transition-colors"
                          title="Toggle sort order"
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform ${sortOrder === 'oldest' ? 'rotate-180' : ''}`} />
                          {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                        </button>
                        <Badge variant="secondary" className="shrink-0">{filteredVideos.length} items</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-[var(--dq-text-muted)]">Type:</span>
                    <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" count={videos.length} />
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) =>
                      <FilterChip key={key} active={filterType === key} onClick={() => setFilterType(key as ContentType)} label={cfg.label} count={typeCounts[key] || 0} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-8">
                    <span className="text-xs text-[var(--dq-text-muted)]">Deck:</span>
                    <FilterChip active={filterUrgency === 'all'} onClick={() => setFilterUrgency('all')} label="All Decks" />
                    {(['Tomorrow', 'Weekend', 'Reference'] as UrgencyLevel[]).map(u => (
                      <FilterChip key={u} active={filterUrgency === u} onClick={() => setFilterUrgency(u)} label={u} count={urgencyCounts[u] || 0} />
                    ))}
                  </div>

                  {filteredVideos.length === 0 ? (
                    <FadeIn className="text-center py-24 text-[var(--dq-text-muted)] border border-dashed border-[var(--dq-border)] rounded-2xl">
                      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                        <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      </motion.div>
                      <p className="font-medium">No videos found.</p>
                      <p className="text-sm mt-1 text-[var(--dq-text-subtle)]">Save a video using the extension to get started.</p>
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
                            onUpdateNotes={handleUpdateNotes}
                            onUpdateTranscript={handleUpdateTranscript}
                            onSetUrgency={handleSetUrgency}
                            scrapeVersion={scrapeVersion}
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
                    <FadeIn className="text-center py-24 text-[var(--dq-text-muted)] border border-dashed border-[var(--dq-border)] rounded-2xl">
                      <Hash className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      <p className="font-medium">No channels detected yet.</p>
                      <p className="text-sm mt-1 text-[var(--dq-text-subtle)]">Save some videos — channels will appear here automatically.</p>
                    </FadeIn>
                  ) : (
                    <StaggerList className="grid gap-3">
                      {channels.map(ch => (
                        <StaggerItem key={ch.id}>
                          <HoverCard className="glass-card p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400 font-bold text-lg overflow-hidden shrink-0">
                                {ch.authorImage ? (
                                  <img src={ch.authorImage} alt={ch.name} className="w-full h-full object-cover" />
                                ) : (
                                  ch.name?.[0]?.toUpperCase() || '?'
                                )}
                              </div>
                              <div>
                                {ch.url ? (
                                  <a href={ch.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="font-semibold text-sm hover:text-lime-300 transition-colors flex items-center gap-1">
                                    {ch.name} <ExternalLink className="w-3 h-3 opacity-60" />
                                  </a>
                                ) : (
                                  <p className="font-semibold text-sm text-[var(--dq-text)]">{ch.name}</p>
                                )}
                                <div className="text-xs text-[var(--dq-text-muted)] mt-1 flex items-center gap-2">
                                  <span>{ch.videoCount ?? 1} saved video{(ch.videoCount ?? 1) !== 1 ? 's' : ''}</span>
                                  {ch.platform && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-[var(--dq-border)]" />
                                      <span className="opacity-80">{ch.platform}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setSearchQuery(ch.name); setActiveTab('videos'); }}
                                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--dq-border)] bg-[var(--dq-bg)] hover:bg-lime-500/10 hover:text-lime-400 transition-colors"
                              >
                                View Queue
                              </button>
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
                  <FadeIn className="text-center py-24 text-[var(--dq-text-muted)] border border-dashed border-[var(--dq-border)] rounded-2xl">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="font-medium">Coming soon.</p>
                    <p className="text-sm mt-1 text-[var(--dq-text-subtle)]">Join accountability circles with friends.</p>
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



