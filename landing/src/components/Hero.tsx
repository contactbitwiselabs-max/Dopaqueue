"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";

// ── Live Dopamine Budget demo ───────────────────────────────────────
// A real, ticking simulation of the extension's core mechanic instead of
// a static screenshot: the budget drains, the plant reacts, and the
// Speed Bump takes over when it hits zero — then the day resets.

const TOTAL = 60;

function plantFor(pct: number) {
  if (pct >= 0.7) return { emoji: "\ud83c\udf3f", label: "thriving", color: "text-lime-400" };
  if (pct >= 0.3) return { emoji: "\ud83c\udf31", label: "okay", color: "text-yellow-400" };
  if (pct > 0) return { emoji: "\ud83e\udd40", label: "wilting", color: "text-orange-400" };
  return { emoji: "\ud83d\udc80", label: "budget spent", color: "text-zinc-500" };
}

function BudgetDemo() {
  const [remaining, setRemaining] = useState(44);

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => (r <= 0 ? TOTAL : r - 1));
    }, 750);
    return () => clearInterval(t);
  }, []);

  const pct = remaining / TOTAL;
  const plant = plantFor(pct);
  const spent = remaining <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* stacked "queue ticket" layers behind the card */}
      <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rotate-[2.5deg] rounded-3xl border border-white/5 bg-[#0e0e0c]" />
      <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-[1.2deg] rounded-3xl border border-white/5 bg-[#101010]" />

      <div className="relative rounded-3xl border border-white/10 bg-[#121211] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>dopamine_budget</span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${spent ? "bg-red-400" : "bg-lime-400"} animate-pulse`} />
            live
          </span>
        </div>

        {/* big remaining counter */}
        <div className="mt-5 flex items-end gap-2">
          <span className="font-mono text-6xl font-bold tabular-nums text-white leading-none">
            {String(remaining).padStart(2, "0")}
          </span>
          <span className="font-mono text-sm text-zinc-500 pb-1">min left today</span>
        </div>

        {/* drain bar */}
        <div className="mt-5 h-2 rounded-full bg-zinc-800/80 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${pct > 0.3 ? "bg-lime-400" : "bg-orange-400"}`}
            animate={{ width: `${Math.max(0, pct * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        {/* plant status */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={plant.label}
                initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.4, opacity: 0, rotate: 12 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="text-3xl"
              >
                {plant.emoji}
              </motion.span>
            </AnimatePresence>
            <div>
              <p className={`text-sm font-semibold ${plant.color}`}>{plant.label}</p>
              <p className="font-mono text-[11px] text-zinc-500">your garden reacts in real time</p>
            </div>
          </div>
          <span className="font-mono text-[11px] text-zinc-600">yt/shorts · ig/reels</span>
        </div>

        {/* speed bump takeover */}
        <AnimatePresence>
          {spent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 rounded-3xl bg-[#0b0b09]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-red-400">speed bump</span>
              <p className="text-white font-semibold">Budget spent. Watch something you actually saved:</p>
              <div className="w-full space-y-2 mt-1">
                <div className="rounded-xl border border-white/10 bg-[#141413] px-4 py-2.5 text-left text-sm text-zinc-300 flex items-center justify-between">
                  <span className="truncate">How to Learn Anything Faster</span>
                  <span className="font-mono text-[10px] text-lime-400 shrink-0 ml-3">tomorrow</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#141413] px-4 py-2.5 text-left text-sm text-zinc-300 flex items-center justify-between">
                  <span className="truncate">Rust Concurrency in 10 Minutes</span>
                  <span className="font-mono text-[10px] text-yellow-400 shrink-0 ml-3">weekend</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const;

export const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-grain pt-36 pb-24">
      {/* warm glow, off-center on purpose */}
      <div aria-hidden className="absolute -top-32 right-[-12%] w-[520px] h-[520px] rounded-full bg-lime-400/[0.06] blur-[130px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/90 mb-6"
          >
            ⏚ the anti-doomscroll extension
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease }}
            className="text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.05]"
          >
            Spend attention
            <br />
            like it&apos;s{" "}
            <span className="relative inline-block">
              money.
              <motion.span
                aria-hidden
                className="absolute left-0 -bottom-1.5 h-[4px] bg-lime-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.55, delay: 0.7, ease }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
            className="mt-6 text-lg text-zinc-400 max-w-xl leading-relaxed"
          >
            DopaQueue puts a price on every mindless scroll and a purpose behind
            every save. A daily budget, a plant that lives or dies by it, and a
            queue that turns Shorts-brain into a second brain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease }}
            className="mt-10 flex flex-col sm:flex-row gap-3"
          >
            <button className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-lime-400 text-[#0a0a08] font-bold text-sm hover:bg-lime-300 active:scale-[0.98] transition-all">
              Add to Chrome — it&apos;s free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <Link
              href="/share/demo"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-colors"
            >
              Preview a shared deck
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-lime-500/70" />
            local-first · no tracking · your data exports anywhere
          </motion.p>
        </div>

        <BudgetDemo />
      </div>
    </section>
  );
};
