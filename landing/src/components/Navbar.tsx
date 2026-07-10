"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { MagneticButton } from "./ui/MagneticButton";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Stats", href: "#stats" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.85]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.08]);
  const blur = useTransform(scrollY, [0, 100], [0, 20]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(10, 10, 8, ${v})`),
        borderBottom: useTransform(borderOpacity, (v) => `1px solid rgba(255,255,255,${v})`),
        backdropFilter: useTransform(blur, (v) => `blur(${v}px)`),
        WebkitBackdropFilter: useTransform(blur, (v) => `blur(${v}px)`),
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.span
            className="text-2xl"
            animate={{ rotate: scrolled ? 360 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            🌿
          </motion.span>
          <motion.span
            className="text-lg font-bold text-white tracking-tight"
            animate={{ opacity: 1 }}
          >
            DopaQueue
          </motion.span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-lime-400/20 bg-lime-400/10 text-lime-400">
            beta
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative text-sm text-zinc-400 hover:text-white transition-colors duration-300 group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[var(--dq-lime)] rounded-full transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link
            href="/share/demo"
            className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Live demo
          </Link>
          <MagneticButton
            className="text-sm px-5 py-2.5 rounded-xl bg-[var(--dq-lime)] text-[#0a0a08] font-bold hover:bg-lime-300 transition-colors cursor-pointer"
            strength={0.15}
          >
            Get Extension
          </MagneticButton>
        </div>
      </div>
    </motion.nav>
  );
}
