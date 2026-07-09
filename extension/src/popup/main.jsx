import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '../index.css';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { ThemeProvider } from '../shared/theme.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
