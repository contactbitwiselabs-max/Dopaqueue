import React from 'react';
import Link from 'next/link';
import { decodeShareId, SharedPlaylistPayload } from '@/lib/share';
import { PlayCircle, Share2, ExternalLink, Sparkles, Tag, Clock, CheckCircle2, BookmarkCheck } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SharedPlaylistPage({ params }: PageProps) {
  const { id } = await params;
  const decoded = decodeShareId(id);

  const playlist: SharedPlaylistPayload = decoded || {
    v: 1,
    title: 'Curated DopaQueue Watchlist',
    curator: 'Focused Mind',
    createdAt: Date.now(),
    items: [
      {
        title: 'Designing Data-Intensive Applications: Deep Dive',
        url: 'https://www.youtube.com/watch?v=example1',
        type: 'video',
        tags: ['#systems', '#architecture'],
        urgency: 'Tomorrow',
      },
      {
        title: 'How to Read a Paper Efficiently',
        url: 'https://www.youtube.com/watch?v=example2',
        type: 'video',
        tags: ['#research', '#learning'],
        urgency: 'Weekend',
      },
      {
        title: 'Rust Concurrency Explained in 10 Minutes',
        url: 'https://www.youtube.com/watch?v=example3',
        type: 'video',
        tags: ['#rust', '#concurrency'],
        urgency: 'Reference',
      },
    ],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30">
      {/* Navbar */}
      <nav className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
              DopaQueue
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Shared Deck
            </span>
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
          >
            Get Extension Free
          </Link>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="relative overflow-hidden py-16 border-b border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-purple-500/15 blur-[120px] pointer-events-none rounded-full" />
        
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-4">
            <Share2 className="w-3.5 h-3.5" /> Curated Review Queue
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl">
            {playlist.title}
          </h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-zinc-400">
            <span>Curated by <strong className="text-zinc-200">{playlist.curator}</strong></span>
            <span>•</span>
            <span className="text-purple-400 font-semibold">{playlist.items.length} intentional items</span>
          </div>
        </div>
      </section>

      {/* Items List */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-4">
          {playlist.items.map((item, idx) => (
            <div
              key={idx}
              className="group p-5 rounded-2xl bg-zinc-900/60 border border-white/5 hover:border-purple-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                    {item.type || 'Video'}
                  </span>
                  {item.urgency && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {item.urgency}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                  {item.title}
                </h3>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="text-xs text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  Watch <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Import Banner CTA */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-zinc-900 to-blue-900/40 border border-purple-500/30 text-center space-y-4">
          <BookmarkCheck className="w-10 h-10 mx-auto text-purple-400" />
          <h2 className="text-2xl font-bold text-white">Want to import this playlist into your Second Brain?</h2>
          <p className="text-sm text-zinc-300 max-w-lg mx-auto">
            Install DopaQueue to save videos with intentionality speed bumps, get AI action item checklists, and review with spaced repetition.
          </p>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg"
            >
              <Sparkles className="w-4 h-4 text-purple-600" /> Install DopaQueue Extension
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
