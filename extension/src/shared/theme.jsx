// DopaQueue Theme System
// Premium glassmorphism design with Apple-inspired aesthetics
// Supports: Light, Dark, System mode with smooth transitions

import { useEffect, useState } from 'react';

/**
 * Theme types
 */
export const THEME_TYPES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

/**
 * Theme configuration
 * Apple-inspired glassmorphism with subtle effects
 */
export const THEME_CONFIG = {
  [THEME_TYPES.LIGHT]: {
    name: 'Light',
    background: 'bg-gray-50',
    surface: 'bg-white/80 backdrop-blur-xl',
    surfaceElevated: 'bg-white/90 backdrop-blur-xl',
    border: 'border-gray-200',
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      muted: 'text-gray-400',
    },
    glass: {
      subtle: 'bg-white/60 backdrop-blur-2xl',
      medium: 'bg-white/80 backdrop-blur-xl',
      strong: 'bg-white/95 backdrop-blur-lg',
    },
    gradient: {
      primary: 'from-blue-500 to-cyan-500',
      secondary: 'from-purple-500 to-pink-500',
      success: 'from-emerald-500 to-teal-500',
    },
    shadow: {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg shadow-blue-500/10',
      xl: 'shadow-xl shadow-blue-500/15',
    },
  },
  [THEME_TYPES.DARK]: {
    name: 'Dark',
    background: 'bg-gray-950',
    surface: 'bg-gray-900/80 backdrop-blur-xl',
    surfaceElevated: 'bg-gray-800/90 backdrop-blur-xl',
    border: 'border-gray-800',
    text: {
      primary: 'text-gray-100',
      secondary: 'text-gray-400',
      muted: 'text-gray-600',
    },
    glass: {
      subtle: 'bg-gray-900/60 backdrop-blur-2xl',
      medium: 'bg-gray-900/80 backdrop-blur-xl',
      strong: 'bg-gray-900/95 backdrop-blur-lg',
    },
    gradient: {
      primary: 'from-blue-600 to-cyan-600',
      secondary: 'from-purple-600 to-pink-600',
      success: 'from-emerald-600 to-teal-600',
    },
    shadow: {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg shadow-blue-500/20',
      xl: 'shadow-xl shadow-blue-500/30',
    },
  },
};

// Storage key for theme preference
const THEME_STORAGE_KEY = 'dq_theme_preference';

/**
 * Get system theme preference
 */
function getSystemTheme() {
  if (typeof window === 'undefined') return THEME_TYPES.LIGHT;
  
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return THEME_TYPES.DARK;
  }
  
  return THEME_TYPES.LIGHT;
}

/**
 * Get stored theme preference
 */
function getStoredTheme() {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEME_TYPES).includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  
  return null;
}

/**
 * Set theme preference
 */
function setStoredTheme(theme) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage not available
  }
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
  const stored = getStoredTheme();
  
  if (stored === THEME_TYPES.SYSTEM) {
    return getSystemTheme();
  }
  
  return stored || THEME_TYPES.SYSTEM;
}

/**
 * Set theme
 */
export function setTheme(theme) {
  if (!Object.values(THEME_TYPES).includes(theme)) {
    console.warn(`[DopaQueue] Invalid theme: ${theme}`);
    return;
  }
  
  setStoredTheme(theme);
  applyTheme(theme);
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  const actualTheme = theme === THEME_TYPES.SYSTEM ? getSystemTheme() : theme;
  
  // Remove all theme classes
  html.classList.remove('light', 'dark');
  
  // Add current theme class
  html.classList.add(actualTheme);
  
  // Set data attribute for CSS variables
  html.setAttribute('data-theme', actualTheme);
  
  // Update CSS variables
  updateCssVariables(actualTheme);
}

/**
 * Update CSS variables for theme
 */
function updateCssVariables(theme) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  const config = THEME_CONFIG[theme];
  
  // Set theme-specific CSS variables
  root.style.setProperty('--theme-bg', config.background);
  root.style.setProperty('--theme-surface', config.surface);
  root.style.setProperty('--theme-surface-elevated', config.surfaceElevated);
  root.style.setProperty('--theme-border', config.border);
  root.style.setProperty('--theme-text-primary', config.text.primary);
  root.style.setProperty('--theme-text-secondary', config.text.secondary);
  root.style.setProperty('--theme-text-muted', config.text.muted);
}

/**
 * Initialize theme system
 */
export function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  
  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const stored = getStoredTheme();
      if (stored === THEME_TYPES.SYSTEM) {
        applyTheme(THEME_TYPES.SYSTEM);
      }
    });
  }
}

/**
 * Theme hook for React components
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => getCurrentTheme());
  
  useEffect(() => {
    // Listen for storage changes (from other tabs/windows)
    const handleStorageChange = (e) => {
      if (e.key === THEME_STORAGE_KEY) {
        setThemeState(getCurrentTheme());
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      setThemeState(getCurrentTheme());
    };
    
    mediaQuery.addEventListener('change', handleSystemChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);
  
  const toggleTheme = () => {
    const current = getStoredTheme() || THEME_TYPES.SYSTEM;
    const themes = Object.values(THEME_TYPES);
    const currentIndex = themes.indexOf(current);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    setTheme(nextTheme);
    setThemeState(nextTheme === THEME_TYPES.SYSTEM ? getSystemTheme() : nextTheme);
  };
  
  const setTheme = (newTheme) => {
    setStoredTheme(newTheme);
    applyTheme(newTheme);
    setThemeState(newTheme === THEME_TYPES.SYSTEM ? getSystemTheme() : newTheme);
  };
  
  return {
    theme: theme === THEME_TYPES.SYSTEM ? getSystemTheme() : theme,
    actualTheme: theme,
    setTheme,
    toggleTheme,
    isDark: theme === THEME_TYPES.DARK || (theme === THEME_TYPES.SYSTEM && getSystemTheme() === THEME_TYPES.DARK),
    isLight: theme === THEME_TYPES.LIGHT || (theme === THEME_TYPES.SYSTEM && getSystemTheme() === THEME_TYPES.LIGHT),
  };
}

/**
 * Theme provider component
 */
export function ThemeProvider({ children }) {
  useEffect(() => {
    initTheme();
  }, []);
  
  return children;
}

/**
 * Get theme config for current theme
 */
export function getThemeConfig() {
  const theme = getCurrentTheme();
  const actualTheme = theme === THEME_TYPES.SYSTEM ? getSystemTheme() : theme;
  return THEME_CONFIG[actualTheme];
}

/**
 * Theme toggle button component
 */
export function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
      title={`Current theme: ${theme}`}
    >
      {isDark ? (
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export default {
  THEME_TYPES,
  THEME_CONFIG,
  getCurrentTheme,
  setTheme,
  initTheme,
  useTheme,
  ThemeProvider,
  ThemeToggle,
  getThemeConfig,
};
