"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, DownloadCloud, Lock, PlayCircle, Zap } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const FeatureCard = ({
  index,
  title,
  description,
  icon,
  className,
}: {
  index: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.07, ease }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#121211] border border-white/[0.07] p-6",
        "transition-all duration-300 hover:border-lime-400/25 hover:-translate-y-1 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7)]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-lime-400/90 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">{icon}</div>
        <span className="font-mono text-[11px] text-zinc-600 tracking-widest">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-6">
        <h3 className="mb-2 text-xl font-semibold text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>

      {/* corner glow on hover */}
      <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-lime-400/[0.06] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
    </motion.div>
  );
};

export const Features = () => {
  return (
    <section id="features" className="py-28 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
          className="mb-16 max-w-2xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/80 mb-4">what&apos;s inside</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Built like a budget app.
            <br />
            Plays like a game.
          </h2>
          <p className="text-zinc-400">
            Every mechanic exists to move minutes from the algorithm&apos;s pocket
            back into yours — wrapped in a local-first experience you own.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            index={0}
            className="md:col-span-2 md:row-span-2 min-h-[300px]"
            title="Local-First Privacy"
            description="Your data never leaves your device unless you want it to. Completely offline-capable with on-demand cloud syncing via Supabase — and row-level security when you do."
            icon={<Lock className="w-8 h-8" />}
          />
          <FeatureCard
            index={1}
            title="Dopamine Budgeting"
            description="Gamify your focus. Your virtual plant wilts when you scroll mindlessly, and thrives when you watch saved content."
            icon={<Clock className="w-8 h-8" />}
          />
          <FeatureCard
            index={2}
            title="Universal Save"
            description="Save YouTube videos, Shorts, and Instagram Reels directly to your queue with a single click."
            icon={<PlayCircle className="w-8 h-8" />}
          />
          <FeatureCard
            index={3}
            title="Smart Transcripts"
            description="Automatically extract and save transcripts from YouTube videos without relying on expensive APIs."
            icon={<Zap className="w-8 h-8" />}
          />
          <FeatureCard
            index={4}
            className="md:col-span-2"
            title="Rich Export"
            description="Download your saved videos, channels, and AI-generated notes to Markdown, Notion, Obsidian, or CSV — your second brain is portable by design."
            icon={<DownloadCloud className="w-8 h-8" />}
          />
        </div>
      </div>
    </section>
  );
};
