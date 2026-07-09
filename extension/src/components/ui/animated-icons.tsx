import React from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';

// ─── Base wrapper for animated icon ──────────────────────────────
interface AnimatedIconProps {
  className?: string;
  size?: number;
  onClick?: () => void;
  children: React.ReactNode;
}

function AnimatedIcon({ className = '', size = 20, onClick, children }: AnimatedIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      {children}
    </motion.span>
  );
}

// ─── Save / Bookmark icon ─────────────────────────────────────────
interface SaveIconProps {
  saved?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export function SaveIcon({ saved = false, size = 20, className = '', onClick }: SaveIconProps) {
  return (
    <AnimatedIcon size={size} className={className} onClick={onClick}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
          animate={saved ? { pathLength: 1, fill: 'currentColor' } : { pathLength: 1, fill: 'rgba(0,0,0,0)' }}
          initial={{ pathLength: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      </svg>
    </AnimatedIcon>
  );
}

// ─── Check / Done icon ────────────────────────────────────────────
interface CheckIconProps {
  checked?: boolean;
  size?: number;
  className?: string;
}

export function AnimatedCheckIcon({ checked = false, size = 20, className = '' }: CheckIconProps) {
  return (
    <AnimatePresence mode="wait">
      {checked ? (
        <motion.span
          key="check"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 30 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className={`inline-flex items-center justify-center ${className}`}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <motion.path
              d="M20 6L9 17l-5-5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </svg>
        </motion.span>
      ) : (
        <motion.span
          key="circle"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className={`inline-flex items-center justify-center ${className}`}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx={12} cy={12} r={10} />
          </svg>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ─── Delete / Trash icon ──────────────────────────────────────────
interface DeleteIconProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

export function DeleteIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.15, color: '#f87171' }}
      whileTap={{ scale: 0.85, rotate: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </motion.span>
  );
}

// ─── Share icon ───────────────────────────────────────────────────
export function ShareIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.15, rotate: 15 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </motion.span>
  );
}

// ─── Export / Download icon ───────────────────────────────────────
export function ExportIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.1, y: 2 }}
      whileTap={{ scale: 0.88, y: 4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </motion.span>
  );
}

// ─── Refresh / Sync icon ──────────────────────────────────────────
interface SyncIconProps extends DeleteIconProps {
  spinning?: boolean;
}

export function SyncIcon({ size = 20, className = '', onClick, spinning = false }: SyncIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 1, repeat: Infinity, ease: 'linear' } : { type: 'spring' }}
      whileHover={!spinning ? { rotate: 180 } : undefined}
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    </motion.span>
  );
}

// ─── External Link icon ────────────────────────────────────────────
export function ExternalLinkIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.15, x: 2, y: -2 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </motion.span>
  );
}

// ─── Copy icon ─────────────────────────────────────────────────────
interface CopyIconProps extends DeleteIconProps {
  copied?: boolean;
}

export function CopyIcon({ size = 20, className = '', onClick, copied = false }: CopyIconProps) {
  return (
    <AnimatePresence mode="wait">
      {copied ? (
        <motion.span
          key="copied"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className={`inline-flex items-center justify-center text-lime-400 ${className}`}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M20 6L9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
          </svg>
        </motion.span>
      ) : (
        <motion.span
          key="copy"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className={`inline-flex items-center justify-center cursor-pointer ${className}`}
          onClick={onClick}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ─── Tag icon ──────────────────────────────────────────────────────
export function TagIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.15, rotate: -10 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    </motion.span>
  );
}

// ─── Plant health icon ─────────────────────────────────────────────
interface PlantIconProps {
  health: number; // 0-100
  size?: number;
  className?: string;
}

export function PlantIcon({ health, size = 24, className = '' }: PlantIconProps) {
  const color = health > 70 ? '#86efac' : health > 40 ? '#fde68a' : health > 20 ? '#fb923c' : '#6b7280';
  const pulse = health > 70;

  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      animate={pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={pulse ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
      style={{ width: size, height: size, color }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12" />
        <path d="M12 12C12 12 8 9 8 5a4 4 0 018 0c0 4-4 7-4 7z" />
        <path d="M12 12C12 12 16 9 16 5" />
        <path d="M8 22h8" />
      </svg>
    </motion.span>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────
export function SpinnerIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    </motion.span>
  );
}

// ─── Plus / Add icon ──────────────────────────────────────────────
export function AddIcon({ size = 20, className = '', onClick }: DeleteIconProps) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.2, rotate: 90 }}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </motion.span>
  );
}

// ─── Search icon ──────────────────────────────────────────────────
export function SearchIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </span>
  );
}

// ─── Magic Sparkles icon ───────────────────────────────────────────
export function SparklesIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.73 12.73.707.707M3 12h1m16 0h1M4.22 19.78l.707-.707M18.95 5.05l.707-.707" />
        <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    </motion.span>
  );
}
