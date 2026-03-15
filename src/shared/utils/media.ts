import API_BASE_CONFIG from "../../config/apiBase";

export function getArtistInitials(nameOrHandle: unknown): string {
  const raw = String(nameOrHandle ?? "").trim();
  if (!raw) return "?";

  const cleaned = raw.replace(/^[@/]+/, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

export function resolveMediaUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  if (ABSOLUTE_HTTP_URL.test(raw)) return raw;
  if (/^(data|blob|javascript):/i.test(raw)) return null;

  const base = String(API_BASE_CONFIG ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  if (raw.startsWith("/")) {
    return `${base}${raw}`;
  }

  return `${base}/${raw}`;
}
