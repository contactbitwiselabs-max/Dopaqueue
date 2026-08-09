import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, ArrowLeft, ExternalLink, Search, Image, FileText,
  PlayCircle, Zap, Film, Camera, Link2, Globe, ChevronRight,
  X, Filter
} from 'lucide-react';
import { getScrapeResult } from '../../shared/storage.js';
import type { QueueItem } from '../../types';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FadeIn, SlideUp, StaggerList, StaggerItem, HoverCard } from '../../components/motion';

// ─── Platform Detection ─────────────────────────────────────────────
interface PlatformInfo {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PLATFORMS: Record<string, PlatformInfo> = {
  youtube:   { name: 'YouTube',   color: '#ff0000', bgColor: 'rgba(255,0,0,0.08)',    borderColor: 'rgba(255,0,0,0.2)' },
  instagram: { name: 'Instagram', color: '#e1306c', bgColor: 'rgba(225,48,108,0.08)', borderColor: 'rgba(225,48,108,0.2)' },
  x:         { name: 'X',         color: '#a0a0a0', bgColor: 'rgba(160,160,160,0.08)',borderColor: 'rgba(160,160,160,0.2)' },
  reddit:    { name: 'Reddit',    color: '#ff4500', bgColor: 'rgba(255,69,0,0.08)',   borderColor: 'rgba(255,69,0,0.2)' },
  tiktok:    { name: 'TikTok',    color: '#00f2ea', bgColor: 'rgba(0,242,234,0.08)',  borderColor: 'rgba(0,242,234,0.2)' },
  linkedin:  { name: 'LinkedIn',  color: '#0a66c2', bgColor: 'rgba(10,102,194,0.08)', borderColor: 'rgba(10,102,194,0.2)' },
  website:   { name: 'Website',   color: '#84cc16', bgColor: 'rgba(132,204,22,0.08)', borderColor: 'rgba(132,204,22,0.2)' },
};

function detectPlatform(url: string): string {
  if (!url) return 'website';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  if (u.includes('reddit.com')) return 'reddit';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'website';
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function detectContentType(url: string, explicitType?: string): string {
  if (explicitType && ['video', 'short', 'reel', 'post', 'image', 'article', 'screenshot', 'link'].includes(explicitType)) return explicitType;
  if (!url) return 'link';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  if (/twitter\.com|x\.com|reddit\.com|linkedin\.com/i.test(url)) return 'post';
  if (/(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitch\.tv)/i.test(url)) return 'video';
  return 'link';
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  video: PlayCircle,
  short: Zap,
  reel: Film,
  post: Image,
  image: Image,
  article: FileText,
  screenshot: Camera,
  link: Link2,
};

// ─── Source Type ─────────────────────────────────────────────────────
interface DerivedSource {
  key: string;
  name: string;
  url: string;
  authorImage: string | null;
  platform: string;
  platformInfo: PlatformInfo;
  domain: string;
  videoCount: number;
  contentTypes: string[];
  contentBreakdown: Record<string, number>;
  lastSavedAt: number;
  items: QueueItem[];
}

// ─── Source Detail View ─────────────────────────────────────────────
function SourceDetail({
  source,
  onBack,
}: {
  source: DerivedSource;
  onBack: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = searchQuery.trim()
    ? source.items.filter(item =>
        (item.title || item.url || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : source.items;

  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-[var(--dq-text-muted)] hover:text-[var(--dq-text)]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0 border-2"
            style={{ borderColor: source.platformInfo.borderColor, backgroundColor: source.platformInfo.bgColor }}
          >
            {source.authorImage ? (
              <img src={source.authorImage} alt={source.name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: source.platformInfo.color }}>{source.name[0]?.toUpperCase() || '?'}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{source.name}</h1>
              {source.url && (
                <a href={source.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[var(--dq-text-muted)] hover:text-lime-400 transition-colors shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge
                style={{ backgroundColor: source.platformInfo.bgColor, color: source.platformInfo.color, borderColor: source.platformInfo.borderColor }}
                className="border text-[10px] font-semibold"
              >
                {source.platformInfo.name}
              </Badge>
              <span className="text-xs text-[var(--dq-text-muted)]">
                {source.videoCount} save{source.videoCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-[var(--dq-text-subtle)]">·</span>
              <span className="text-xs text-[var(--dq-text-subtle)]">
                {source.domain}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Type Breakdown */}
      {source.contentTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(source.contentBreakdown).map(([type, count]) => {
            const Icon = TYPE_ICONS[type] || Link2;
            return (
              <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs">
                <Icon className="w-3.5 h-3.5 text-[var(--dq-text-muted)]" />
                <span className="capitalize font-medium">{type}</span>
                <span className="text-[var(--dq-text-subtle)]">({count})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {source.items.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search saved items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map(item => {
          const cType = detectContentType(item.url, item.contentType || item.type as string);
          const TypeIcon = TYPE_ICONS[cType] || Link2;
          return (
            <motion.a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="block group"
            >
              <Card className="glass-card overflow-hidden border border-[var(--dq-border)] hover:border-zinc-600/50 transition-all h-52 flex flex-col cursor-pointer">
                <div className="h-24 relative overflow-hidden bg-zinc-900 flex items-center justify-center shrink-0">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                  ) : (
                    <TypeIcon className="w-8 h-8 text-zinc-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 to-transparent" />
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 text-[9px] bg-black/50 backdrop-blur-sm border-white/10 capitalize"
                  >
                    {cType}
                  </Badge>
                </div>
                <CardContent className="p-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-lime-300 transition-colors">{item.title || 'Untitled'}</h3>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--dq-text-muted)]">
                    <span>{new Date(item.savedAt as number).toLocaleDateString()}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </motion.a>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--dq-text-muted)]">
          {searchQuery.trim() ? 'No items match your search.' : 'No items from this source.'}
        </div>
      )}
    </FadeIn>
  );
}


// ─── Main Sources Page ──────────────────────────────────────────────
export default function Channels({ videos }: { videos: QueueItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<DerivedSource | null>(null);

  // Derive sources from videos
  const sources: DerivedSource[] = useMemo(() => {
    const sourceMap = new Map<string, {
      name: string;
      url: string;
      authorImage: string | null;
      platform: string;
      domain: string;
      contentTypes: Set<string>;
      contentBreakdown: Record<string, number>;
      lastSavedAt: number;
      items: QueueItem[];
    }>();

    videos.forEach(v => {
      const scrape = getScrapeResult(v.url) || {} as any;
      const name = scrape.channel || scrape.author || v.channel || v.channelName || v.author || null;
      if (!name) return;

      const authorUrl = scrape.authorUrl || v.authorUrl || '';
      const authorImage = scrape.authorImage || null;
      const platform = detectPlatform(v.url);
      const domain = getDomain(v.url);
      const cType = scrape.contentType || detectContentType(v.url, v.contentType || v.type as string);
      const key = name.toLowerCase();

      if (sourceMap.has(key)) {
        const existing = sourceMap.get(key)!;
        existing.items.push(v);
        existing.contentTypes.add(cType);
        existing.contentBreakdown[cType] = (existing.contentBreakdown[cType] || 0) + 1;
        if ((v.savedAt as number) > existing.lastSavedAt) existing.lastSavedAt = v.savedAt as number;
        if (!existing.authorImage && authorImage) existing.authorImage = authorImage;
        if (!existing.url && authorUrl) existing.url = authorUrl;
      } else {
        sourceMap.set(key, {
          name,
          url: authorUrl,
          authorImage,
          platform,
          domain,
          contentTypes: new Set([cType]),
          contentBreakdown: { [cType]: 1 },
          lastSavedAt: v.savedAt as number,
          items: [v],
        });
      }
    });

    return Array.from(sourceMap.entries())
      .map(([key, val]) => ({
        key,
        name: val.name,
        url: val.url,
        authorImage: val.authorImage,
        platform: val.platform,
        platformInfo: PLATFORMS[val.platform] || PLATFORMS.website,
        domain: val.domain,
        videoCount: val.items.length,
        contentTypes: Array.from(val.contentTypes),
        contentBreakdown: val.contentBreakdown,
        lastSavedAt: val.lastSavedAt,
        items: val.items.sort((a, b) => (b.savedAt as number) - (a.savedAt as number)),
      }))
      .sort((a, b) => b.videoCount - a.videoCount);
  }, [videos]);

  // Collect unique platforms present
  const availablePlatforms = useMemo(() => {
    const set = new Set(sources.map(s => s.platform));
    return Array.from(set).sort();
  }, [sources]);

  // Filter
  const filteredSources = useMemo(() => {
    let result = sources;
    if (platformFilter !== 'all') {
      result = result.filter(s => s.platform === platformFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.domain.includes(q));
    }
    return result;
  }, [sources, platformFilter, searchQuery]);

  // Total stats
  const totalSaves = sources.reduce((sum, s) => sum + s.videoCount, 0);

  // ─── Detail View ───
  if (selectedSource) {
    return (
      <SourceDetail
        source={selectedSource}
        onBack={() => setSelectedSource(null)}
      />
    );
  }

  // ─── Main View ───
  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Hash className="w-8 h-8 text-lime-400" />
            Sources
          </h1>
          <p className="text-sm text-[var(--dq-text-muted)]">
            {sources.length} source{sources.length !== 1 ? 's' : ''} · {totalSaves} total save{totalSaves !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Search + Platform Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search sources by name or domain..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Platform chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            platformFilter === 'all'
              ? 'bg-lime-500/15 text-lime-400 border-lime-500/30'
              : 'bg-transparent text-[var(--dq-text-muted)] border-[var(--dq-border)] hover:border-zinc-600'
          }`}
        >
          All ({sources.length})
        </button>
        {availablePlatforms.map(p => {
          const info = PLATFORMS[p] || PLATFORMS.website;
          const count = sources.filter(s => s.platform === p).length;
          return (
            <button
              key={p}
              onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                platformFilter === p
                  ? 'scale-105 shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: platformFilter === p ? info.bgColor : 'transparent',
                color: platformFilter === p ? info.color : undefined,
                borderColor: platformFilter === p ? info.borderColor : 'var(--dq-border)',
              }}
            >
              {info.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Sources Grid */}
      {filteredSources.length === 0 ? (
        <FadeIn className="py-20 text-center border border-dashed border-[var(--dq-border)] rounded-2xl">
          {sources.length === 0 ? (
            <>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                <Hash className="w-14 h-14 mx-auto mb-5 opacity-30 text-[var(--dq-text-muted)]" />
              </motion.div>
              <p className="font-medium text-lg text-[var(--dq-text-muted)]">No sources detected yet</p>
              <p className="text-sm text-[var(--dq-text-subtle)] mt-1">Save some content — sources will appear here automatically.</p>
            </>
          ) : (
            <>
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30 text-[var(--dq-text-muted)]" />
              <p className="font-medium text-[var(--dq-text-muted)]">No sources match your search</p>
              <Button variant="ghost" className="mt-3 text-lime-400" onClick={() => { setSearchQuery(''); setPlatformFilter('all'); }}>
                Clear filters
              </Button>
            </>
          )}
        </FadeIn>
      ) : (
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map(source => (
            <StaggerItem key={source.key}>
              <Card
                className="glass-card group overflow-hidden border border-[var(--dq-border)] hover:border-lime-500/20 transition-all cursor-pointer flex flex-col"
                onClick={() => setSelectedSource(source)}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  {/* Top Row: Avatar + Name */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden shrink-0 border-2"
                      style={{ borderColor: source.platformInfo.borderColor, backgroundColor: source.platformInfo.bgColor }}
                    >
                      {source.authorImage ? (
                        <img src={source.authorImage} alt={source.name} className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ color: source.platformInfo.color }}>{source.name[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate">{source.name}</h3>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[var(--dq-text-subtle)] hover:text-lime-400 transition-colors shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--dq-text-muted)] truncate">{source.domain}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--dq-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>

                  {/* Middle: Platform Badge + Stats */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      style={{ backgroundColor: source.platformInfo.bgColor, color: source.platformInfo.color, borderColor: source.platformInfo.borderColor }}
                      className="border text-[10px] font-semibold"
                    >
                      {source.platformInfo.name}
                    </Badge>
                    <span className="text-xs text-[var(--dq-text-muted)]">
                      {source.videoCount} save{source.videoCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Bottom: Content type breakdown */}
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {Object.entries(source.contentBreakdown).map(([type, count]) => {
                      const Icon = TYPE_ICONS[type] || Link2;
                      return (
                        <div key={type} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/40 text-[10px] text-[var(--dq-text-muted)]">
                          <Icon className="w-3 h-3" />
                          <span className="capitalize">{count} {type}{count > 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer: last saved */}
                  <div className="pt-2 border-t border-[var(--dq-border)] text-[10px] text-[var(--dq-text-subtle)]">
                    Last saved {new Date(source.lastSavedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </FadeIn>
  );
}
