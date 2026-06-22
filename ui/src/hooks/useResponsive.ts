import { useSyncExternalStore } from 'react';

const DESKTOP_MIN = 840;

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

export interface Viewport {
  width: number;
  height: number;
  isDesktop: boolean;
}

let cached: Viewport = { width: 0, height: 0, isDesktop: false };

function getSnapshot(): Viewport {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Return a stable object identity while dimensions are unchanged, so
  // useSyncExternalStore doesn't see a new value on every render.
  if (width !== cached.width || height !== cached.height) {
    cached = { width, height, isDesktop: width >= DESKTOP_MIN };
  }

  return cached;
}

function getServerSnapshot(): Viewport {
  return cached;
}

export function useResponsive(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
