"use client";

import { SmoothScroll } from "@/components/SmoothScroll";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Stats } from "@/components/Stats";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <SmoothScroll>
      <main className="min-h-screen bg-[var(--dq-bg)]">
        <Navbar />
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Stats />
        <CTA />
        <Footer />
      </main>
    </SmoothScroll>
  );
}
