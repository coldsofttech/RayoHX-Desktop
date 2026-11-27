/** @param {number | null | undefined} value */
export function bytes(value) {
  if (value == null) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units.at(unit)}`;
}

/** @param {number | null | undefined} value */
export const speed = (value) => (value ? `${bytes(value)}/s` : '–');

/** @param {number | null | undefined} seconds */
export function duration(seconds) {
  if (seconds == null) return '–';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** @param {number | null | undefined} bps */
export const bitrate = (bps) => (bps ? `${(bps / 1e6).toFixed(1)} Mbps` : '–');

export const ACTIVE = ['queued', 'inspecting', 'preparing', 'downloading', 'finalizing', 'paused'];
