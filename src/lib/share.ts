import { LIMITS, SHARE_PREFIX, formatBytes } from "@/lib/limits";
import {
  canonicalJson,
  parseSnapshot,
  type ParseResult,
  type Snapshot,
} from "@/lib/snapshot";

export class ShareTooLargeError extends Error {
  constructor() {
    super("This snapshot is too large for a reader link. Download the JSON file instead.");
    this.name = "ShareTooLargeError";
  }
}

export async function encodeShareToken(snapshot: Snapshot): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(snapshot));
  if (bytes.byteLength > LIMITS.maxBytes) throw new ShareTooLargeError();
  const compressed = await deflateRaw(bytes);
  const token = bytesToBase64Url(compressed);
  if (token.length > LIMITS.maxShareTokenLength) throw new ShareTooLargeError();
  return token;
}

export function shareHash(token: string): string {
  return `#${SHARE_PREFIX}${token}`;
}

export async function decodeShareToken(token: string): Promise<ParseResult> {
  if (!token) return { ok: false, error: "This reader link is empty." };
  if (token.length > LIMITS.maxShareTokenLength) {
    return { ok: false, error: "This reader link is too long." };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, error: "This reader link contains characters Margin does not use." };
  }

  let compressed: Uint8Array;
  try {
    compressed = base64UrlToBytes(token);
  } catch {
    return { ok: false, error: "This reader link could not be decoded." };
  }

  let bytes: Uint8Array;
  try {
    bytes = await inflateRaw(compressed, LIMITS.maxBytes);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "This reader link is damaged and could not be unpacked.";
    return { ok: false, error: message };
  }

  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "This reader link did not contain text." };
  }
  return parseSnapshot(json);
}

export function tokenFromHash(hash: string):
  | { kind: "empty" }
  | { kind: "token"; token: string }
  | { kind: "foreign"; raw: string } {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { kind: "empty" };
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.startsWith(SHARE_PREFIX)) {
    return { kind: "token", token: decoded.slice(SHARE_PREFIX.length) };
  }
  return { kind: "foreign", raw: decoded };
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(token: string): Uint8Array {
  const padded =
    token.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (token.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
  } catch {
    throw new Error("This reader link is damaged and could not be unpacked.");
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`This link unpacks to more than ${formatBytes(maxBytes)}.`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This link unpacks")) throw error;
    throw new Error("This reader link is damaged and could not be unpacked.");
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
