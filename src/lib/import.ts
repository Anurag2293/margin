import { parseSnapshot, type Snapshot } from "@/lib/snapshot";
import { isXFamilyUrl, looksLikeBareUrl } from "@/lib/urls";

export type ImportResult =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "url-only"; url: string; x: boolean }
  | { type: "invalid"; error: string };

export function classifyImport(input: string): ImportResult {
  const text = input.replace(/^\uFEFF/, "").trim();
  if (!text) return { type: "invalid", error: "Paste a snapshot first." };
  if (!text.startsWith("{") && looksLikeBareUrl(text)) {
    return { type: "url-only", url: text, x: isXFamilyUrl(text) };
  }
  const parsed = parseSnapshot(text);
  if (!parsed.ok && looksLikeBareUrl(text)) {
    return { type: "url-only", url: text, x: isXFamilyUrl(text) };
  }
  if (!parsed.ok) return { type: "invalid", error: parsed.error };
  return { type: "snapshot", snapshot: parsed.snapshot };
}
