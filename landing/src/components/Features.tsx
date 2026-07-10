"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GlowCard } from "./ui/GlowCard";
import { TextReveal } from "./ui/TextReveal";
import {
  Clock,
  Lock,
  PlayCircle,
  Zap,
  DownloadCloud,
  BarChart3,
  Shield,
  Users,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    title: "Dopamine Budgeting",
    description:
      "Set a daily scroll budget. A virtual plant thrives when you're under it — and wilts when you aren't. Gamification that actually makes you scroll less.",
    icon: Clock,
    color: "#a3e635",
    detail: "Your garden reacts in real-time as you scroll through Shorts & Reels.",
  },
  {
    title: "Universal Save",
    description:
      "One-click save from YouTube, Shorts, Instagram Reels, TikTok, X, Reddit, and LinkedIn. Everything lands in a single queue with auto-transcripts and smart tags.",
    icon: PlayCircle,
    color: "#a3e635",
    detail: "Works across 7 platforms with automatic metadata extraction.",
  },
  {
    title: "Smart Transcripts",
    description:
      "Automatically extract and save transcripts from YouTube videos without expensive APIs. Search through everything you've ever saved — by topic, not title.",
    icon: Zap,
    color: "#fbbf24",
    detail: "Full-text search across all your saved content, instantly.",
  },
  {
    title: "Digital Wellbeing",
    description:
      "Enterprise-grade analytics for your attention. Vulnerability heatmaps, attention decay curves, streak tracking, and platform breakdowns — all computed locally.",
    icon: BarChart3,
    color: "#38bdf8",
    detail: "Pattern detection that reveals your scrolling habits at a glance.",
  },
  {
    title: "Local-First Privacy",
    description:
      "Your data never leaves your device unless you want it to. Completely offline-capable with on-demand cloud syncing and row-level security.",
    icon: Lock,
    color: "#a3e635",
    detail: "Zero trackers. Zero analytics. 100% yours.",
  },
  {
    title: "Rich Export & Circles",
    description:
      "Share curated video collections with friends. Export your queue to Markdown, Notion, Obsidian, or CSV — your second brain is portable by design.",
    icon: Users,
    color: "#e879f9",
    detail: "Collaborative curation meets personal knowledge management.",
  },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !trackRef.current) return;

    const track = trackRef.current;
    const cards = track.querySelectorAll<HTMLElement>(".feature-card");
    const totalWidth = track.scrollWidth - window.innerWidth;

    const scrollTween = gsap.to(track, {
      x: -totalWidth,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: () => `+=${totalWidth}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // Stagger card entries
    cards.forEach((card, i) => {
      gsap.fromTo(
        card,
        { opacity: 0.3, scale: 0.92, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          scrollTrigger: {
            trigger: card,
            containerAnimation: scrollTween,
            start: "left 80%",
            end: "left 40%",
            scrub: 1,
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--dq-bg)]"
    >
      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/80 mb-4"
        >
          what&apos;s inside
        </motion.p>
        <TextReveal
          as="h2"
          className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight"
        >
          Built like a budget app. Plays like a game.
        </TextReveal>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-zinc-400 text-lg max-w-2xl"
        >
          Every mechanic exists to move minutes from the algorithm&apos;s pocket
          back into yours — wrapped in a local-first experience you own.
        </motion.p>
      </div>

      {/* Horizontal Scroll Track */}
      <div ref={trackRef} className="flex items-stretch gap-8 px-6 pb-28 will-change-transform">
        {FEATURES.map((feature, i) => (
          <div
            key={i}
            className="feature-card shrink-0 w-[85vw] md:w-[550px] lg:w-[600px]"
          >
            <GlowCard className="h-full">
              <div className="p-8 md:p-10 flex flex-col h-full min-h-[400px]">
                {/* Top row */}
                <div className="flex items-start justify-between mb-8">
                  <div
                    className="p-3 rounded-2xl border border-white/5"
                    style={{ backgroundColor: `${feature.color}10` }}
                  >
                    <feature.icon
                      className="w-7 h-7 transition-transform duration-300"
                      style={{ color: feature.color }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-zinc-600 tracking-widest">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed text-base flex-1">
                  {feature.description}
                </p>

                {/* Bottom detail */}
                <div className="mt-8 pt-6 border-t border-white/5">
                  <p className="font-mono text-xs text-zinc-500 tracking-wide">
                    {feature.detail}
                  </p>
                </div>
              </div>
            </GlowCard>
          </div>
        ))}
      </div>
    </section>
  );
}
