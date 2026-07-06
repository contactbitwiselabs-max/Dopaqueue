import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-tight">DopaQueue</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-sm text-zinc-400 hover:text-white transition-colors">Log in</button>
            <button className="text-sm px-4 py-2 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition-colors">
              Get Extension
            </button>
          </div>
        </div>
      </nav>

      <Hero />
      <Features />

      <footer className="py-8 border-t border-white/5 text-center text-zinc-500">
        <p>© 2026 DopaQueue. Built for deep focus.</p>
      </footer>
    </main>
  );
}
