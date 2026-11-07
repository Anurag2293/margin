/** Bounds for one snapshot. Documented for anyone producing reader links. */
export const LIMITS = {
  /** UTF-8 size of the JSON text, before compression. */
  maxBytes: 48 * 1024,
  /** UTF-16 code units, after cleaning. Applies to post text and quoted text. */
  maxText: 12_000,
  maxName: 50,
  maxHandle: 15,
  maxAlt: 1_000,
  maxMedia: 4,
  /** base64url length of the compressed hash token. */
  maxShareTokenLength: 24_000,
  maxLang: 35,
  maxSourceUrl: 500,
  maxBio: 500,
  maxLocation: 100,
  maxWebsite: 300,
  /** Length of the avatar data URI, header included. */
  maxAvatar: 20_000,
  maxCount: 1e12,
} as const;

export const FORMAT = "single-post-snapshot" as const;
export const VERSION = 1 as const;
export const SHARE_PREFIX = "s1.";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  const rounded = kb >= 10 ? Math.round(kb) : Math.round(kb * 10) / 10;
  return `${rounded} KB`;
}
