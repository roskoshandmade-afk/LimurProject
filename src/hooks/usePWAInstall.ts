import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const MOBILE_BANNER_DISMISSED_KEY = 'limur_pwa_mobile_banner_dismissed_v1';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): { isIOS: boolean; isAndroid: boolean } {
  if (typeof window === 'undefined') {
    return { isIOS: false, isAndroid: false };
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  return { isIOS, isAndroid };
}

function readBannerDismissed(): boolean {
  try {
    return localStorage.getItem(MOBILE_BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function usePWAInstall(options?: { onInstalled?: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [{ isIOS, isAndroid }] = useState(() => detectPlatform());
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => readBannerDismissed());

  const onInstalledRef = useRef(options?.onInstalled);
  const notifiedInstallRef = useRef(false);
  onInstalledRef.current = options?.onInstalled;

  useEffect(() => {
    setIsStandalone(detectStandalone());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      if (!notifiedInstallRef.current) {
        notifiedInstallRef.current = true;
        onInstalledRef.current?.();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const promptNativeInstall = useCallback(async (): Promise<
    'accepted' | 'dismissed' | 'unavailable'
  > => {
    if (!deferredPrompt) {
      return 'unavailable';
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
        if (!notifiedInstallRef.current) {
          notifiedInstallRef.current = true;
          onInstalledRef.current?.();
        }
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(MOBILE_BANNER_DISMISSED_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  return {
    canPromptNative: Boolean(deferredPrompt),
    isStandalone,
    isIOS,
    isAndroid,
    bannerDismissed,
    dismissBanner,
    promptNativeInstall,
  };
}
