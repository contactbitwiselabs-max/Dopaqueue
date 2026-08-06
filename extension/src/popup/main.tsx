// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
// C12: reducedMotion="user" tells framer-motion to honour the OS-level
// prefers-reduced-motion media query and disable non-essential animations
// for users who request it.
import { MotionConfig } from 'framer-motion';
import App from './App.tsx';
import '../index.css';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { ThemeProvider } from '../shared/theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>,
);

