// App-wide zoom (the whole studio, not just the canvas). Applied as CSS zoom on <html>,
// so popovers and dialogs scale too. Positions computed from getBoundingClientRect()/clientX
// are in screen pixels; divide them by the zoom before putting them in a style.

const KEY = 'savor-studio-app-zoom';
export const APP_ZOOMS = [0.6, 0.67, 0.75, 0.8, 0.85, 0.9, 1, 1.1, 1.25, 1.4, 1.5];
let zoom = (() => { try { const z = Number(localStorage.getItem(KEY)); return z >= 0.5 && z <= 2 ? z : 1; } catch { return 1; } })();
const listeners = new Set<(z: number) => void>();

export const appZoom = () => zoom;
/** Screen pixels → CSS pixels of the zoomed app. */
export const unzoom = (px: number) => px / zoom;

export function applyAppZoom() {
  document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
}

export function setAppZoom(z: number) {
  zoom = Math.round(Math.min(2, Math.max(0.5, z)) * 100) / 100;
  try { localStorage.setItem(KEY, String(zoom)); } catch {}
  applyAppZoom();
  listeners.forEach(fn => fn(zoom));
  window.dispatchEvent(new Event('resize'));
}

export function stepAppZoom(dir: 1 | -1 | 0) {
  if (dir === 0) return setAppZoom(1);
  const i = APP_ZOOMS.findIndex(z => z >= zoom - 0.001);
  const cur = i < 0 ? APP_ZOOMS.length - 1 : i;
  const exact = Math.abs(APP_ZOOMS[cur] - zoom) < 0.001;
  setAppZoom(APP_ZOOMS[Math.max(0, Math.min(APP_ZOOMS.length - 1, dir > 0 ? (exact ? cur + 1 : cur) : cur - 1))]);
}

export function onAppZoom(fn: (z: number) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
