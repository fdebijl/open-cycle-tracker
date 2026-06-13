import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Scales day markers up as the pointer approaches them — the React port of the
 * Ember `child-proximity-scaler` modifier. Mutates child DOM nodes directly
 * (selected by `[data-day-marker]`) rather than through React state, so moving
 * the pointer doesn't re-render 28 markers per frame.
 */

const SCALE_RADIUS_PX = 90;
const MIN_EM = 1;
const MAX_EM = 4;
const SHOW_LABEL_THRESHOLD = 0.2;

export function useProximityScaler(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const markers = () => container.querySelectorAll<HTMLElement>('[data-day-marker]');

    function apply(clientX: number, clientY: number) {
      for (const marker of markers()) {
        const rect = marker.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const distance = Math.hypot(clientX - cx, clientY - cy);
        const factor = Math.min(1, Math.max(0, 1 - distance / SCALE_RADIUS_PX));
        const size = MIN_EM + factor * (MAX_EM - MIN_EM);
        marker.style.width = `${size}em`;
        marker.style.height = `${size}em`;
        marker.style.zIndex = `${Math.round(factor * 100)}`;
        marker.dataset.scaled = factor > SHOW_LABEL_THRESHOLD ? '1' : '0';
      }
    }

    function reset() {
      for (const marker of markers()) {
        marker.style.width = '';
        marker.style.height = '';
        marker.style.zIndex = '';
        marker.dataset.scaled = '0';
      }
    }

    const onMove = (e: PointerEvent) => apply(e.clientX, e.clientY);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', reset);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', reset);
    };
  }, [ref]);
}
