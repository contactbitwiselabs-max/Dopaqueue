"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface TextRevealProps {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  scrub?: boolean;
}

export function TextReveal({
  children,
  className = "",
  as: Tag = "p",
  delay = 0,
  scrub = false,
}: TextRevealProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const words = containerRef.current.querySelectorAll(".word");

    if (scrub) {
      gsap.fromTo(
        words,
        { opacity: 0.15, y: 8 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );
    } else {
      gsap.fromTo(
        words,
        { opacity: 0, y: 20, rotateX: -40 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          stagger: 0.04,
          duration: 0.6,
          ease: "power3.out",
          delay,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === containerRef.current) t.kill();
      });
    };
  }, [delay, scrub]);

  const words = children.split(" ");

  return (
    <Tag
      ref={containerRef as React.Ref<HTMLElement>}
      className={`${className}`}
      style={{ perspective: "600px" }}
    >
      {words.map((word, i) => (
        <span
          key={i}
          className="word inline-block"
          style={{ transformOrigin: "bottom center" }}
        >
          {word}
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </Tag>
  );
}
