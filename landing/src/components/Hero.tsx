"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, ChevronDown } from "lucide-react";
import { gsap } from "gsap";
import dynamic from "next/dynamic";
import { MagneticButton } from "./ui/MagneticButton";

const DemoScene = dynamic(
  () => import("./DemoScene").then((m) => m.DemoScene),
  { ssr: false }
);

// ── Live Budget Demo (repurposed from old Hero) ──
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
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rotate-[2.5deg] rounded-3xl border border-white/5 bg-[#0e0e0c]" />
      <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-[1.2deg] rounded-3xl border border-white/5 bg-[#101010]" />

      <div className="relative rounded-3xl border border-white/10 bg-[#121211] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>dopamine_budget</span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${spent ? "bg-red-400" : "bg-lime-400"} animate-pulse`} />
            live
          </span>
        </div>

        <div className="mt-5 flex items-end gap-2">
          <span className="font-mono text-6xl font-bold tabular-nums text-white leading-none">
            {String(remaining).padStart(2, "0")}
          </span>
          <span className="font-mono text-sm text-zinc-500 pb-1">min left today</span>
        </div>

        <div className="mt-5 h-2 rounded-full bg-zinc-800/80 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${pct > 0.3 ? "bg-lime-400" : "bg-orange-400"}`}
            animate={{ width: `${Math.max(0, pct * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

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
          <span className="font-mono text-[10px] text-zinc-600">yt/shorts · ig/reels</span>
        </div>

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

// ── Character Stagger Heading ──
function StaggerHeading({ text, delay = 0 }: { text: string; delay?: number }) {
  const chars = text.split("");
  return (
    <span className="inline-block">
      {chars.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40, rotateX: -60 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            duration: 0.5,
            delay: delay + i * 0.025,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
          style={{ transformOrigin: "bottom center" }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

// ── Hero ──
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden bg-grain"
    >
      {/* Background Gradient Orbs — parallax on mouse */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)` }}
      >
        <div className="absolute top-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-lime-400/[0.04] blur-[120px]" />
        <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] rounded-full bg-lime-400/[0.03] blur-[100px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-emerald-400/[0.02] blur-[80px]" />
      </div>

      {/* 3D Scene Background */}
      <div className="absolute inset-0 opacity-60">
        <DemoScene className="w-full h-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-20 items-center w-full">
        {/* Left: Text */}
        <div>
          <motion.p
            initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/90 mb-6"
          >
            ⏚ the anti-doomscroll extension
          </motion.p>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.05]"
            style={{ perspective: "600px" }}
          >
            <StaggerHeading text="Spend attention" delay={0.1} />
            <br />
            <StaggerHeading text="like it's " delay={0.5} />
            <span className="relative inline-block">
              <StaggerHeading text="money." delay={0.7} />
              <motion.span
                aria-hidden
                className="absolute left-0 -bottom-2 h-[4px] bg-lime-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.6, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 text-lg md:text-xl text-zinc-400 max-w-xl leading-relaxed"
          >
            DopaQueue puts a price on every mindless scroll and a purpose behind
            every save. A daily budget, a plant that lives or dies by it, and a
            queue that turns Shorts-brain into a second brain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col sm:flex-row gap-4"
          >
            <MagneticButton
              className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-[var(--dq-lime)] text-[#0a0a08] font-bold text-sm hover:bg-lime-300 active:scale-[0.98] transition-all cursor-pointer"
              strength={0.2}
            >
              Add to Chrome — it&apos;s free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
            <Link
              href="/share/demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all"
            >
              Preview a shared deck
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="mt-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-lime-500/70" />
            local-first · no tracking · your data exports anywhere
          </motion.p>
        </div>

        {/* Right: Budget Demo */}
        <BudgetDemo />
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">scroll</span>
        <ChevronDown className="w-4 h-4 text-zinc-600 scroll-hint-arrow" />
      </motion.div>
    </section>
  );
}
