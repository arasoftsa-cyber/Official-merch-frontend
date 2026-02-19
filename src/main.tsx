import './index.css';

const bootElem = document.getElementById('root');
if (bootElem) {
  bootElem.innerHTML = "<div style='padding:16px;font-family:monospace'>BOOT PROBE: main.tsx executed</div>";
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import AppErrorBoundary from './components/ux/AppErrorBoundary';
import { ToastProvider } from './components/ux/ToastHost';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

const sanitize = (value: string) => value.replace(/</g, '&lt;');
const isAbort = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const maybe = err as any;
  if (maybe?.name === 'AbortError') return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }
  const msg = String(maybe?.message ?? maybe);
  return msg.toLowerCase().includes('aborted') && msg.toLowerCase().includes('signal');
};
const writeCrash = (headline: string, message: string) => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  let overlay = document.getElementById('crash-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'crash-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;padding:16px;background:#fff;z-index:9999;overflow:auto;font-family:monospace;';
    rootEl.appendChild(overlay);
  } else if (!overlay.parentElement) {
    rootEl.appendChild(overlay);
  }
  overlay.innerHTML = `<pre style="white-space:pre-wrap;">${headline}\n\n${sanitize(message)}</pre>`;
};

window.addEventListener('error', (event) => {
  const msg =
    (event as any)?.error?.stack ||
    (typeof event?.message === 'string' ? event.message : null) ||
    JSON.stringify(event);
  writeCrash('FRONTEND CRASH', msg ?? 'Unknown error');
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as any)?.reason;
  if (isAbort(reason)) {
    event.preventDefault();
    return;
  }
  const msg =
    reason?.stack || reason?.message || JSON.stringify(reason) ||
    'Unknown rejection';
  writeCrash('FRONTEND CRASH (unhandledrejection)', msg);
});

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
} catch (error: any) {
  writeCrash('FRONTEND CRASH', `${error?.message ?? 'Unknown error'}${error?.stack ? `\n${error.stack}` : ''}`);
}
