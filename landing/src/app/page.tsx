import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";

const MARQUEE_TEXT =
  "no shorts \u2715 no reels \u2715 no infinite feeds \u2715 your queue, your rules \u2726 spend attention like money \u2726 ";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden>\ud83c\udf3f</span>
            <span className="text-lg font-bold text-white tracking-tight">DopaQueue</span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-lime-400/20 bg-lime-400/10 text-lime-400">
              beta
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <a href="#features" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">
              Features
            </a>
            <Link href="/share/demo" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">
              Live demo
            </Link>
            <button className="text-sm px-4 py-2 rounded-xl bg-lime-400 text-[#0a0a08] font-bold hover:bg-lime-300 transition-colors">
              Get Extension
            </button>
          </div>
        </div>
      </nav>

      <Hero />

      {/* anti-feed marquee */}
      <div className="border-y border-white/5 bg-[#0e0e0c] py-3 overflow-hidden" aria-hidden>
        <div className="flex w-max animate-marquee-slow">
          {[0, 1].map((copy) => (
            <span
              key={copy}
              className="font-mono text-xs tracking-[0.35em] uppercase text-zinc-600 whitespace-nowrap pr-8"
            >
              {MARQUEE_TEXT.repeat(2)}
            </span>
          ))}
        </div>
      </div>

      <Features />

      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-white font-bold">
              <span aria-hidden>\ud83c\udf3f</span> DopaQueue
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
              built for deep focus · © 2026
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-zinc-500">
            <a href="#features" className="hover:text-lime-400 transition-colors">features</a>
            <Link href="/share/demo" className="hover:text-lime-400 transition-colors">shared decks</Link>
            <span className="text-zinc-700">privacy-first · no trackers</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
