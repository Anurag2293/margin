const BLOCKED_ROOTS = ["x.com", "twitter.com", "twimg.com", "t.co"] as const;

/** Hosts this reader must never request or turn into ordinary links. */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (!host) return false;
  return BLOCKED_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
}
