import React from 'react';
import Link from 'next/link';
import { decodeShareId, SharedPlaylistPayload } from '@/lib/share';
import { ExternalLink, Sparkles, FolderHeart } from 'lucide-react';
import { GlowCard } from '@/components/ui/GlowCard';
import { MagneticButton } from '@/components/ui/MagneticButton';

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
    <main className="min-h-screen bg-[var(--dq-bg)] text-[var(--dq-text)] font-sans bg-grain relative overflow-hidden pb-24">
      {/* Background Grid & Glows */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `linear-gradient(rgba(163,230,53,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.3) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-lime-400/[0.03] blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-[#0a0a08]/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-xl">🌿</span>
            <span className="text-sm font-bold text-white tracking-tight">
              DopaQueue
            </span>
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-lime-400/20 bg-lime-400/10 text-lime-400">
              shared deck
            </span>
          </Link>
          <MagneticButton
            href="/"
            className="text-xs px-4 py-2 rounded-xl bg-[var(--dq-lime)] text-[#0a0a08] font-bold hover:bg-lime-300 transition-colors cursor-pointer"
            strength={0.15}
          >
            Get Extension Free
          </MagneticButton>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="relative py-16 border-b border-white/5 bg-[#0a0a08]/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lime-400/5 border border-lime-400/10 text-lime-400 text-xs font-semibold mb-4">
            <FolderHeart className="w-3.5 h-3.5" /> Curated Watch Stack
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white max-w-3xl leading-tight">
            {playlist.title}
          </h1>
          <div className="flex items-center gap-4 mt-6 text-sm text-[var(--dq-text-muted)] font-medium">
            <span>Curated by <strong className="text-white">{playlist.curator}</strong></span>
            <span>•</span>
            <span className="text-[var(--dq-lime)] font-mono">{playlist.items.length} intentional items</span>
          </div>
        </div>
      </section>

      {/* Items List */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-6">
          {playlist.items.map((item, idx) => (
            <GlowCard key={idx} className="w-full">
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--dq-surface-elevated)] border border-white/5 text-[var(--dq-text-muted)]">
                      {item.type || 'Video'}
                    </span>
                    {item.urgency && (
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20">
                        {item.urgency}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white hover:text-[var(--dq-lime)] transition-colors leading-snug">
                    {item.title}
                  </h3>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {item.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[10px] text-[var(--dq-text-muted)] bg-[var(--dq-surface-elevated)] border border-white/5 px-2 py-0.5 rounded font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
                  {item.url ? (
                    <MagneticButton
                      href={item.url}
                      className="px-5 py-3 rounded-xl bg-[var(--dq-surface-elevated)] border border-white/5 hover:border-white/10 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                      strength={0.1}
                    >
                      Watch <ExternalLink className="w-3.5 h-3.5 text-[var(--dq-lime)]" />
                    </MagneticButton>
                  ) : (
                    <span className="px-5 py-3 rounded-xl bg-zinc-900/40 text-zinc-600 text-xs font-semibold">
                      Link unavailable
                    </span>
                  )}
                </div>
              </div>
            </GlowCard>
          ))}
        </div>

        {/* Import Banner CTA */}
        <div className="mt-20 relative overflow-hidden rounded-3xl border border-white/5 bg-[#0e0e0c] p-8 md:p-12 text-center space-y-6">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-lime-400/[0.02] blur-[80px] pointer-events-none" />
          
          <span className="text-4xl inline-block animate-bounce" style={{ animationDuration: '3s' }}>🌿</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">Want to import this watchlist into your queue?</h2>
          <p className="text-sm md:text-base text-[var(--dq-text-muted)] max-w-lg mx-auto leading-relaxed">
            Install DopaQueue to save videos with intentionality speed bumps, get AI action items, and build a second brain instead of scrolling.
          </p>
          <div className="pt-2">
            <MagneticButton
              href="/"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-[var(--dq-lime)] text-[#0a0a08] font-bold text-sm hover:bg-lime-300 transition-colors shadow-lg shadow-lime-400/5 cursor-pointer"
              strength={0.2}
            >
              <Sparkles className="w-4 h-4" /> Install DopaQueue Extension
            </MagneticButton>
          </div>
        </div>
      </section>
    </main>
  );
}
