import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import AppErrorBoundary from './shared/components/ux/AppErrorBoundary';
import { ToastProvider } from './shared/components/ux/ToastHost';
import { API_BASE } from './shared/api/baseUrl';

const isDev = Boolean(import.meta.env.DEV);
const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

if (isDev) {
  // eslint-disable-next-line no-console
  console.log(`[api] resolved base URL: ${API_BASE}`);
}

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
  if (!isDev) {
    // eslint-disable-next-line no-console
    console.error(headline, message);
    return;
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'padding:16px;min-height:100vh;background:#fff;color:#111;font-family:system-ui,sans-serif;';

  const title = document.createElement('h1');
  title.textContent = 'Something went wrong';
  title.style.cssText = 'margin:0 0 8px 0;font-size:20px;';
  wrapper.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Please reload the page or try again shortly.';
  subtitle.style.cssText = 'margin:0;';
  wrapper.appendChild(subtitle);

  const pre = document.createElement('pre');
  pre.textContent = `${headline}\n\n${message || 'Unknown error'}`;
  pre.style.cssText = 'white-space:pre-wrap;margin-top:16px;font-size:12px;';
  wrapper.appendChild(pre);

  rootEl.appendChild(wrapper);
};

if (isDev) {
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
}

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
