"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MagneticButton } from "./ui/MagneticButton";

gsap.registerPlugin(ScrollTrigger);

export function CTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    gsap.fromTo(
      sectionRef.current.querySelector(".cta-heading"),
      { opacity: 0, y: 60, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 md:py-40 overflow-hidden"
    >
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(163, 230, 53, 0.08), transparent)",
          }}
        />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-lime-400/[0.03] blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-emerald-400/[0.02] blur-[100px] animate-float"
          style={{ animationDelay: "3s" }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono text-xs tracking-[0.3em] uppercase text-lime-400/80 mb-8"
        >
          ready to reclaim your attention?
        </motion.p>

        <h2 className="cta-heading text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
          <span className="text-gradient">Stop scrolling.</span>
          <br />
          <span className="text-white">Start building.</span>
        </h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-xl text-zinc-400 max-w-xl mx-auto"
        >
          Join thousands who turned their Watch Later graveyard into an active second brain.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <MagneticButton
            className="group inline-flex items-center justify-center gap-2.5 px-10 py-5 rounded-2xl bg-[var(--dq-lime)] text-[#0a0a08] font-bold text-base hover:bg-lime-300 active:scale-[0.98] transition-all cursor-pointer glow-lime"
            strength={0.25}
          >
            Add to Chrome — it&apos;s free
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </MagneticButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600"
        >
          no sign-up required · works offline · free forever
        </motion.p>
      </div>
    </section>
  );
}
