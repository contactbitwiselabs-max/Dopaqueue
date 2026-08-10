import { useColorScheme } from 'react-native';

export const lightColors = {
  primary: '#16a34a', // Dopaqueue forest green
  primaryLight: '#bbf7d0',
  primaryDark: '#15803d',
  
  background: '#ffffff',
  surface: '#f9fafb',

  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#ffffff',

  border: '#e5e7eb',

  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Urgency flags
  urgencyMustSee: '#ef4444',
  urgencySoon: '#f59e0b',
  urgencyWhenever: '#3b82f6',
};

export const darkColors = {
  primary: '#16a34a',
  primaryLight: '#064e3b',
  primaryDark: '#15803d',
  
  background: '#111827',
  surface: '#1f2937',

  text: '#f9fafb',
  textMuted: '#9ca3af',
  textLight: '#ffffff',

  border: '#374151',

  danger: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',

  urgencyMustSee: '#f87171',
  urgencySoon: '#fbbf24',
  urgencyWhenever: '#60a5fa',
};

// Default export for gradual migration
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '600' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? darkColors : lightColors;

  return {
    colors: themeColors,
    spacing,
    borderRadius,
    typography,
    shadows,
    isDark: colorScheme === 'dark'
  };
};
