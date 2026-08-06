// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App.tsx';
import '../index.css';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { ThemeProvider } from '../shared/theme';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#ff4444', fontFamily: 'monospace', background: '#111', height: '100vh', overflow: 'auto' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Dashboard Crashed!</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginBottom: '20px', background: '#222', padding: '15px', borderRadius: '8px' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#222', padding: '15px', borderRadius: '8px', fontSize: '12px' }}>{this.state.error?.stack}</pre>
          <button style={{ marginTop: '20px', padding: '10px 20px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => { localStorage.clear(); chrome?.storage?.local?.clear(); window.location.reload(); }}>Clear Data & Reload</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <App />
          </ToastProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

