"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextReveal } from "./ui/TextReveal";
import { Download, Save, TrendingUp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    number: "01",
    title: "Install the extension",
    description:
      "Add DopaQueue to Chrome in one click. No sign-up needed — it's local-first by design. Your scroll budget starts ticking the moment you open your first Short.",
    icon: Download,
    visual: (
      <div className="relative w-full max-w-[280px] mx-auto">
        {/* Browser bar mockup */}
        <div className="rounded-2xl border border-white/10 bg-[#121211] p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
            </div>
            <div className="flex-1 h-7 rounded-lg bg-zinc-800/60 flex items-center px-3">
              <span className="text-[10px] text-zinc-500 font-mono">chrome://extensions</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-lime-400/5 border border-lime-400/10">
            <span className="text-2xl">🌿</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">DopaQueue</p>
              <p className="text-[10px] text-zinc-500">Active</p>
            </div>
            <div className="w-8 h-4 rounded-full bg-lime-400/80 relative">
              <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "Scroll mindfully, save intentionally",
    description:
      "As you scroll through Shorts and Reels, your budget ticks down. See something worth learning? One tap saves it to your queue with auto-transcripts and tags.",
    icon: Save,
    visual: (
      <div className="relative w-full max-w-[280px] mx-auto">
        <div className="rounded-2xl border border-white/10 bg-[#121211] p-4 shadow-2xl">
          {/* Video mockup */}
          <div className="w-full h-36 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center mb-3 relative overflow-hidden">
            <div className="text-4xl">📱</div>
            {/* Save popup */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-400/90 text-[10px] font-bold text-black">
              <Save className="w-3 h-3" /> Saved!
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded-full bg-zinc-800 w-3/4" />
            <div className="h-3 rounded-full bg-zinc-800 w-1/2" />
            <div className="flex gap-1.5 mt-3">
              <span className="px-2 py-1 rounded-md bg-lime-400/10 text-lime-400 text-[10px] font-mono">#productivity</span>
              <span className="px-2 py-1 rounded-md bg-lime-400/10 text-lime-400 text-[10px] font-mono">#learning</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    title: "Review, grow, and export",
    description:
      "Open your dashboard to review saved content, watch your streaks grow, and track your wellbeing analytics. Export everything to your favourite knowledge tool.",
    icon: TrendingUp,
    visual: (
      <div className="relative w-full max-w-[280px] mx-auto">
        <div className="rounded-2xl border border-white/10 bg-[#121211] p-4 shadow-2xl">
          {/* Dashboard mockup */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🌿</span>
            <span className="text-xs font-semibold text-white">Dashboard</span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 text-[10px] font-mono">7d streak</span>
          </div>
          {/* Mini chart */}
          <div className="flex items-end gap-1 h-20 mb-3">
            {[30, 45, 20, 55, 35, 25, 15].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: h > 40 ? "#f87171" : "#a3e635", opacity: 0.7 }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-zinc-800/50">
              <p className="text-[10px] text-zinc-500">Saved</p>
              <p className="text-sm font-bold text-white">42</p>
            </div>
            <div className="p-2 rounded-lg bg-zinc-800/50">
              <p className="text-[10px] text-zinc-500">Reclaimed</p>
              <p className="text-sm font-bold text-lime-400">3.2h</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !stepsRef.current) return;

    const steps = stepsRef.current.querySelectorAll<HTMLElement>(".how-step");

    steps.forEach((step, i) => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: step,
          start: "top 75%",
          end: "top 30%",
          scrub: 1,
        },
      });

      tl.fromTo(
        step.querySelector(".step-content"),
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0, duration: 0.6 }
      );
      tl.fromTo(
        step.querySelector(".step-visual"),
        { opacity: 0, x: 40, scale: 0.9 },
        { opacity: 1, x: 0, scale: 1, duration: 0.6 },
        "<0.1"
      );

      // Line grow
      const line = step.querySelector(".step-line");
      if (line) {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            scrollTrigger: {
              trigger: step,
              start: "top 60%",
              end: "bottom 60%",
              scrub: 1,
            },
          }
        );
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-28 bg-[var(--dq-bg)] overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-lime-400/[0.02] blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/80 mb-4"
        >
          how it works
        </motion.p>
        <TextReveal
          as="h2"
          className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-20"
        >
          Three steps to reclaim your attention
        </TextReveal>

        <div ref={stepsRef} className="space-y-24 md:space-y-32">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="how-step relative grid md:grid-cols-2 gap-12 md:gap-20 items-center"
            >
              {/* Content */}
              <div className="step-content">
                <div className="flex items-center gap-4 mb-6">
                  <span className="font-mono text-5xl font-bold text-lime-400/20">
                    {step.number}
                  </span>
                  <div className="p-2.5 rounded-xl bg-lime-400/5 border border-lime-400/10">
                    <step.icon className="w-5 h-5 text-lime-400" />
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed text-base max-w-md">
                  {step.description}
                </p>
              </div>

              {/* Visual */}
              <div className="step-visual flex justify-center">
                {step.visual}
              </div>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div
                  className="step-line absolute left-6 md:left-[45px] bottom-0 w-[2px] h-24 bg-gradient-to-b from-lime-400/30 to-transparent origin-top hidden md:block"
                  style={{ transform: "translateY(100%)" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
