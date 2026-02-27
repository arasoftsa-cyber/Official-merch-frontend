export function getArtistInitials(nameOrHandle: unknown): string {
  const raw = String(nameOrHandle ?? "").trim();
  if (!raw) return "?";

  const cleaned = raw.replace(/^[@/]+/, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function resolveMediaUrl(url: unknown, apiBaseUrl: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  const path = raw.replace(/^\/+/, "");
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}
