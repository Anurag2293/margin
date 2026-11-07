import { LIMITS } from "@/lib/limits";

const STATUS_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

/**
 * Accepts a public status URL and returns a canonical https URL with the
 * query, hash, and trailing media suffix removed. Returns null otherwise.
 */
export function canonicalStatusUrl(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > LIMITS.maxSourceUrl) return null;
  if (/[\u0000-\u001F\u007F\\]/.test(trimmed) || trimmed.includes("@")) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port !== "") return null;

  const host = url.hostname.toLowerCase();
  if (!STATUS_HOSTS.has(host)) return null;

  const path = url.pathname.replace(/\/+$/, "");
  const match = path.match(
    /^\/(?:([A-Za-z0-9_]{1,15})\/status|i\/web\/status)\/(\d{1,20})(?:\/.*)?$/,
  );
  if (!match) return null;

  const id = match[2];
  const canonicalHost = host.endsWith("twitter.com") ? "twitter.com" : "x.com";
  if (match[1]) return `https://${canonicalHost}/${match[1]}/status/${id}`;
  return `https://${canonicalHost}/i/web/status/${id}`;
}

export function looksLikeBareUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2_000 || /\s/.test(trimmed)) return false;
  return /^(https?:\/\/|x\.com\/|twitter\.com\/|www\.x\.com\/|www\.twitter\.com\/|mobile\.twitter\.com\/)/i.test(
    trimmed,
  );
}

export function isXFamilyUrl(text: string): boolean {
  const trimmed = text.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase();
    return (
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com") ||
      host === "t.co" ||
      host.endsWith(".t.co")
    );
  } catch {
    return false;
  }
}
