"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  className = "",
  onClick,
  href,
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const x = useSpring(0, { stiffness: 150, damping: 15 });
  const y = useSpring(0, { stiffness: 150, damping: 15 });
  const scale = useSpring(1, { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseEnter = () => {
    setHovered(true);
    scale.set(1.05);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    x.set(0);
    y.set(0);
    scale.set(1);
  };

  const Tag = href ? "a" : "button";
  const linkProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <motion.div
      ref={ref}
      style={{ x, y, scale }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      <Tag
        className={`relative overflow-hidden ${className}`}
        onClick={onClick}
        {...(linkProps as Record<string, unknown>)}
      >
        {/* Shimmer sweep on hover */}
        <span
          className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ${
            hovered ? "translate-x-full" : ""
          }`}
        />
        <span className="relative z-10">{children}</span>
      </Tag>
    </motion.div>
  );
}
