"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  "no shorts",
  "no reels",
  "no infinite feeds",
  "your queue, your rules",
  "spend attention like money",
  "local-first privacy",
  "dopamine budgeting",
  "second brain, not scroll brain",
];

export function Marquee() {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!innerRef.current || !containerRef.current) return;

    // Base animation
    const tl = gsap.to(innerRef.current, {
      xPercent: -50,
      duration: 30,
      ease: "none",
      repeat: -1,
    });

    // Speed up on scroll velocity
    ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const velocity = Math.abs(self.getVelocity());
        const speed = gsap.utils.clamp(0.5, 3, 1 + velocity / 2000);
        gsap.to(tl, { timeScale: speed, duration: 0.3, overwrite: true });
      },
    });

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="border-y border-white/5 bg-[#0e0e0c] py-4 overflow-hidden mask-fade-x"
    >
      <div ref={innerRef} className="flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-0 shrink-0">
            {ITEMS.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex items-center gap-0 shrink-0">
                <span className="font-mono text-xs tracking-[0.25em] uppercase text-zinc-600 whitespace-nowrap px-6">
                  {item}
                </span>
                <span className="text-lime-400/30 text-xs">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
