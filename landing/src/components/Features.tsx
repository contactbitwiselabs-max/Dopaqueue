import React from "react";
import { cn } from "@/lib/utils";
import { Clock, DownloadCloud, Lock, PlayCircle, Zap } from "lucide-react";

const FeatureCard = ({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-zinc-900/50 border border-white/10 p-6 transition-all hover:bg-zinc-800/80",
        className
      )}
    >
      <div className="z-10 mb-4 text-purple-400">{icon}</div>
      <div className="z-10">
        <h3 className="mb-2 text-xl font-semibold text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      
      {/* Hover gradient effect */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
};

export const Features = () => {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Everything you need for deep focus
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            DopaQueue replaces your mindless scrolling habit with an intentional queue of content, wrapped in a beautiful local-first experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            className="md:col-span-2 md:row-span-2 min-h-[300px]"
            title="Local-First Privacy"
            description="Your data never leaves your device unless you want it to. Completely offline-capable with on-demand cloud syncing via Supabase."
            icon={<Lock className="w-8 h-8" />}
          />
          <FeatureCard
            title="Dopamine Budgeting"
            description="Gamify your focus. Your virtual plant wilts when you scroll mindlessly, and thrives when you watch saved content."
            icon={<Clock className="w-8 h-8" />}
          />
          <FeatureCard
            title="Universal Save"
            description="Save YouTube videos, Shorts, and Instagram Reels directly to your queue with a single click."
            icon={<PlayCircle className="w-8 h-8" />}
          />
          <FeatureCard
            title="Smart Transcripts"
            description="Automatically extract and save transcripts from YouTube videos without relying on expensive APIs."
            icon={<Zap className="w-8 h-8" />}
          />
          <FeatureCard
            className="md:col-span-2"
            title="Rich Export"
            description="Download your saved videos, channels, and AI-generated notes to Markdown, Notion, or Excel CSV formats."
            icon={<DownloadCloud className="w-8 h-8" />}
          />
        </div>
      </div>
    </section>
  );
};
