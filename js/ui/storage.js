/* Local progress must never prevent the game from booting in private mode. */
export function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writeStored(key, value) {
  try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
export function readStoredNumber(key, fallback = 0) {
  const value = Number(readStored(key, fallback));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
export function readStoredObject(key, fallback) {
  try {
    const value = JSON.parse(readStored(key, 'null'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : { ...fallback };
  } catch { return { ...fallback }; }
}
