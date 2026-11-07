import { isBlockedHost } from "@/lib/hosts";

export type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "blocked"; value: string };

const URL_PATTERN = /https:\/\/[^\s<>"'`]+/gi;

/**
 * Split plain text into safe pieces. Only default-port https URLs become
 * anchors. X, Twitter, t.co, and twimg hosts stay visible as text.
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, start) });
    }

    const { url, rest } = trimTrailing(raw);
    const classified = classify(url);
    parts.push(classified);
    if (rest) parts.push({ type: "text", value: rest });
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts;
}

export function classify(raw: string): TextPart {
  if (raw.length > 2_000 || /[@\\\s]/.test(raw)) {
    return { type: "text", value: raw };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { type: "text", value: raw };
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port !== "") {
    return { type: "text", value: raw };
  }

  const writtenHost = raw
    .slice("https://".length)
    .split(/[/?#]/)[0]
    .replace(/\.$/, "")
    .toLowerCase();
  if (writtenHost !== url.hostname.toLowerCase()) {
    return { type: "text", value: raw };
  }

  if (isBlockedHost(url.hostname)) {
    return { type: "blocked", value: raw };
  }

  if (!url.href.startsWith("https://")) {
    return { type: "text", value: raw };
  }

  return { type: "link", value: raw, href: url.href };
}

function trimTrailing(raw: string): { url: string; rest: string } {
  let url = raw;
  let rest = "";

  const punctuation = url.match(/[.,;:!?]+$/);
  if (punctuation) {
    rest = punctuation[0];
    url = url.slice(0, -punctuation[0].length);
  }

  while (url.endsWith(")") && count(url, "(") < count(url, ")")) {
    rest = `)${rest}`;
    url = url.slice(0, -1);
  }
  while (url.endsWith("]") && count(url, "[") < count(url, "]")) {
    rest = `]${rest}`;
    url = url.slice(0, -1);
  }

  return { url, rest };
}

function count(value: string, char: string): number {
  let total = 0;
  for (const piece of value) {
    if (piece === char) total += 1;
  }
  return total;
}
