import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const HUES = [32, 55, 85, 140, 175, 200, 300, 345];

export function Avatar({
  name,
  handle,
  src,
  className,
}: {
  name: string;
  handle: string;
  src?: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        data-testid="avatar-image"
        className={cn("shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }
  const hue = HUES[hash(handle.toLowerCase()) % HUES.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold tracking-tight select-none",
        "bg-[oklch(0.88_0.06_var(--hue))] text-[oklch(0.32_0.08_var(--hue))] dark:bg-[oklch(0.36_0.06_var(--hue))] dark:text-[oklch(0.9_0.05_var(--hue))]",
        className,
      )}
      style={{ "--hue": hue } as CSSProperties}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}
