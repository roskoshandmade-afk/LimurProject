import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white p-6 text-[#0A0A0A]">
          <div className="w-full max-w-md border border-[#0A0A0A] bg-white p-6">
            <div className="text-xs font-semibold tracking-[0.14em] text-[#0A0A0A]">
              LIMUR PROJECT
            </div>
            <h1 className="mt-3 text-lg font-semibold">Ошибка отображения</h1>
            <p className="mt-2 text-xs leading-relaxed text-[#525252]">
              {this.state.message}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-white"
              >
                Перезагрузить
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('limur_studio_os_data_v1');
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A]"
              >
                Сбросить локальный кэш
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function collectLoadedStaticAssetUrls(): string[] {
  const urls = new Set<string>();
  const origin = window.location.origin;

  const pushIfSameOrigin = (rawUrl: string | null | undefined) => {
    if (!rawUrl) return;
    try {
      const parsed = new URL(rawUrl, window.location.href);
      if (parsed.origin === origin && !parsed.pathname.endsWith('/sw.js')) {
        urls.add(parsed.href);
      }
    } catch {
      // ignore invalid URL
    }
  };

  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((el) => {
    pushIfSameOrigin(el.src);
  });

  document
    .querySelectorAll<HTMLLinkElement>('link[href]')
    .forEach((el) => {
      const rel = (el.rel || '').toLowerCase();
      if (
        rel.includes('stylesheet') ||
        rel.includes('modulepreload') ||
        rel.includes('icon') ||
        rel.includes('manifest')
      ) {
        pushIfSameOrigin(el.href);
      }
    });

  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    entries.forEach((entry) => {
      pushIfSameOrigin(entry.name);
    });
  }

  return Array.from(urls);
}

function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        const warmCache = () => {
          const worker = registration.active || navigator.serviceWorker.controller;
          if (!worker) return;
          const urls = collectLoadedStaticAssetUrls();
          if (urls.length > 0) {
            worker.postMessage({ type: 'WARM_CACHE', urls });
          }
        };

        if (registration.active) {
          warmCache();
        } else {
          navigator.serviceWorker.ready
            .then((readyReg) => {
              const worker = readyReg.active || navigator.serviceWorker.controller;
              if (!worker) return;
              const urls = collectLoadedStaticAssetUrls();
              if (urls.length > 0) {
                worker.postMessage({ type: 'WARM_CACHE', urls });
              }
            })
            .catch(() => {
              // ignore
            });
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[LIMUR PROJECT][PWA] Service Worker registration failed:', error);
      });
  });
}

registerServiceWorker();

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
