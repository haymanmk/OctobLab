/* Device preferences live in localStorage so the theme can be applied before the first paint. */
export function readPref<T>(key: string, fallback: T): T { try { const v = localStorage.getItem('octoblab.' + key); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; } }
export function writePref(key: string, value: unknown) { try { if (value == null) localStorage.removeItem('octoblab.' + key); else localStorage.setItem('octoblab.' + key, JSON.stringify(value)); } catch {} }
