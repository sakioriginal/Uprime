export function saveJson(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
