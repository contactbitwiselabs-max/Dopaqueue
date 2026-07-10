"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 2,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = target / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

const STATS = [
  {
    value: 10000,
    suffix: "+",
    label: "Videos saved by users",
    sublabel: "across YouTube, Shorts, Reels, TikTok",
  },
  {
    value: 5000,
    suffix: "+",
    label: "Minutes reclaimed",
    sublabel: "time redirected from mindless scrolling",
  },
  {
    value: 100,
    suffix: "%",
    label: "Local-first",
    sublabel: "zero trackers, zero analytics, 100% yours",
  },
];

export function Stats() {
  return (
    <section id="stats" className="relative py-28 bg-[var(--dq-bg)] overflow-hidden">
      {/* Background grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `linear-gradient(rgba(163,230,53,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/80 mb-4 text-center"
        >
          by the numbers
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mt-16">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="text-center group"
            >
              <div className="relative inline-block">
                {/* Glow behind the number */}
                <div className="absolute -inset-4 rounded-full bg-lime-400/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <span className="relative font-mono text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    duration={2 + i * 0.3}
                  />
                </span>
              </div>
              <p className="mt-4 text-lg font-semibold text-zinc-200">
                {stat.label}
              </p>
              <p className="mt-2 text-sm text-zinc-500 font-mono tracking-wide">
                {stat.sublabel}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
