import { FORMAT, LIMITS, VERSION, formatBytes } from "@/lib/limits";
import { canonicalStatusUrl } from "@/lib/urls";

export type MediaKind = "photo" | "video" | "gif" | "audio";

export type Media = {
  kind: MediaKind;
  alt?: string;
};

export type Quote = {
  authorName: string;
  authorHandle: string;
  text: string;
  createdAt?: string;
  sourceUrl?: string;
  lang?: string;
  media?: Media[];
};

export type Post = Quote & {
  quote?: Quote;
};

export type Snapshot = {
  format: typeof FORMAT;
  version: typeof VERSION;
  example?: true;
  post: Post;
};

export type ParseResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: string };

const MEDIA_KINDS = new Set<MediaKind>(["photo", "video", "gif", "audio"]);
const URL_KEYS = ["url", "src", "href", "source", "previewUrl", "poster"] as const;
const ISO_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const LANG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

export function parseSnapshot(input: string): ParseResult {
  try {
    const text = input.replace(/^\uFEFF/, "");
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > LIMITS.maxBytes) {
      throw new SnapshotError(
        `That snapshot is larger than ${formatBytes(LIMITS.maxBytes)}.`,
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new SnapshotError("This is not valid JSON.");
    }
    return { ok: true, snapshot: parseValue(data) };
  } catch (error) {
    if (error instanceof SnapshotError) return { ok: false, error: error.message };
    throw error;
  }
}

export function toCanonical(snapshot: Snapshot): Snapshot {
  const canonical: Snapshot = {
    format: FORMAT,
    version: VERSION,
    post: canonicalPost(snapshot.post),
  };
  if (snapshot.example) canonical.example = true;
  return canonical;
}

export function canonicalJson(snapshot: Snapshot): string {
  return JSON.stringify(toCanonical(snapshot));
}

export function prettyJson(snapshot: Snapshot): string {
  return JSON.stringify(toCanonical(snapshot), null, 2);
}

function parseValue(data: unknown): Snapshot {
  if (!isPlainObject(data)) fail("A snapshot must be a JSON object.");
  if (own(data, "format") !== FORMAT) fail("format must be single-post-snapshot.");
  if (own(data, "version") !== VERSION) fail("version must be 1.");

  const example = own(data, "example");
  if (example !== undefined && typeof example !== "boolean") {
    fail("example must be true or false.");
  }
  if (!Object.prototype.hasOwnProperty.call(data, "post")) fail("post is missing.");

  const snapshot: Snapshot = {
    format: FORMAT,
    version: VERSION,
    post: parsePost(own(data, "post"), "Post"),
  };
  if (example === true) snapshot.example = true;
  return snapshot;
}

function parsePost(value: unknown, label: "Post" | "Quoted post"): Post {
  if (!isPlainObject(value)) fail(`${label} must be a JSON object.`);
  if (label === "Quoted post" && Object.prototype.hasOwnProperty.call(value, "quote")) {
    fail("A quoted post cannot contain another quote.");
  }

  const authorName = parseName(own(value, "authorName"), label);
  const authorHandle = parseHandle(own(value, "authorHandle"), label);
  const media = parseMedia(own(value, "media"), label);
  const text = parseBody(own(value, "text"), label, media.length > 0);

  const post: Post = { authorName, authorHandle, text };
  const createdAt = parseOptionalTime(own(value, "createdAt"), label);
  const sourceUrl = parseOptionalSource(own(value, "sourceUrl"), label);
  const lang = parseOptionalLang(own(value, "lang"), label);
  if (createdAt) post.createdAt = createdAt;
  if (sourceUrl) post.sourceUrl = sourceUrl;
  if (lang) post.lang = lang;
  if (media.length > 0) post.media = media;

  if (label === "Post" && Object.prototype.hasOwnProperty.call(value, "quote")) {
    const quoteValue = own(value, "quote");
    if (quoteValue === undefined || quoteValue === null) {
      fail("quote must be a JSON object.");
    }
    post.quote = parsePost(quoteValue, "Quoted post");
  }

  return post;
}

function parseName(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`${label} authorName must be text.`);
  const cleaned = clean(value, { multiline: false, stripBidi: true });
  if (!cleaned) fail(`${label} authorName is empty.`);
  if (cleaned.length > LIMITS.maxName) {
    fail(`${label} authorName is longer than ${LIMITS.maxName} characters.`);
  }
  return cleaned;
}

function parseHandle(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`${label} authorHandle must be text.`);
  let cleaned = clean(value, { multiline: false, stripBidi: true });
  if (cleaned.startsWith("@")) cleaned = cleaned.slice(1);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(cleaned)) {
    fail(
      `${label} authorHandle must be 1 to ${LIMITS.maxHandle} letters, numbers, or underscores.`,
    );
  }
  return cleaned;
}

function parseBody(value: unknown, label: string, allowEmpty: boolean): string {
  if (value === undefined) fail(`${label} text is missing.`);
  if (typeof value !== "string") fail(`${label} text must be text.`);
  const cleaned = clean(value, { multiline: true, stripBidi: false });
  if (!cleaned && !allowEmpty) fail(`${label} text is empty.`);
  if (cleaned.length > LIMITS.maxText) {
    fail(`${label} text is longer than ${LIMITS.maxText.toLocaleString("en-US")} characters.`);
  }
  return cleaned;
}

function parseOptionalTime(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} createdAt must be an ISO-8601 timestamp like 2026-04-02T16:30:00.000Z.`);
  }
  const time = value.trim();
  if (!ISO_TIME.test(time) || Number.isNaN(Date.parse(time))) {
    fail(`${label} createdAt must be an ISO-8601 timestamp like 2026-04-02T16:30:00.000Z.`);
  }
  return time;
}

function parseOptionalSource(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    fail(`${label} sourceUrl must be an https link to a public post on x.com or twitter.com.`);
  }
  const canonical = canonicalStatusUrl(value);
  if (!canonical) {
    fail(`${label} sourceUrl must be an https link to a public post on x.com or twitter.com.`);
  }
  return canonical;
}

function parseOptionalLang(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") fail(`${label} lang must be a language tag like en or pt-BR.`);
  const lang = value.trim();
  if (!LANG.test(lang) || lang.length > LIMITS.maxLang) {
    fail(`${label} lang must be a language tag like en or pt-BR.`);
  }
  return lang;
}

function parseMedia(value: unknown, label: string): Media[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${label} media must be an array.`);
  if (value.length > LIMITS.maxMedia) {
    fail(`${label} media can include at most ${LIMITS.maxMedia} items.`);
  }
  return value.map((item, index) => parseMediaItem(item, label, index));
}

function parseMediaItem(value: unknown, label: string, index: number): Media {
  const where = `${label} media item ${index + 1}`;
  if (!isPlainObject(value)) fail(`${where} must be a JSON object.`);
  for (const key of URL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key) && own(value, key) != null) {
      fail(
        "Media cannot include a URL. This reader does not load images or video.",
      );
    }
  }
  const kind = own(value, "kind");
  if (typeof kind !== "string" || !MEDIA_KINDS.has(kind as MediaKind)) {
    fail(`${where} kind must be photo, video, gif, or audio.`);
  }
  const media: Media = { kind: kind as MediaKind };
  if (Object.prototype.hasOwnProperty.call(value, "alt")) {
    const alt = own(value, "alt");
    if (typeof alt !== "string") fail(`${where} alt must be text.`);
    const cleaned = clean(alt, { multiline: true, stripBidi: false });
    if (cleaned.length > LIMITS.maxAlt) {
      fail(`${where} alt is longer than ${LIMITS.maxAlt.toLocaleString("en-US")} characters.`);
    }
    if (cleaned) media.alt = cleaned;
  }
  return media;
}

function canonicalPost(post: Post): Post {
  const canonical: Post = {
    authorName: post.authorName,
    authorHandle: post.authorHandle,
    text: post.text,
  };
  if (post.createdAt) canonical.createdAt = post.createdAt;
  if (post.sourceUrl) canonical.sourceUrl = post.sourceUrl;
  if (post.lang) canonical.lang = post.lang;
  if (post.quote) canonical.quote = canonicalQuote(post.quote);
  if (post.media?.length) canonical.media = post.media.map(canonicalMedia);
  return canonical;
}

function canonicalQuote(quote: Quote): Quote {
  const canonical: Quote = {
    authorName: quote.authorName,
    authorHandle: quote.authorHandle,
    text: quote.text,
  };
  if (quote.createdAt) canonical.createdAt = quote.createdAt;
  if (quote.sourceUrl) canonical.sourceUrl = quote.sourceUrl;
  if (quote.lang) canonical.lang = quote.lang;
  if (quote.media?.length) canonical.media = quote.media.map(canonicalMedia);
  return canonical;
}

function canonicalMedia(media: Media): Media {
  return media.alt ? { kind: media.kind, alt: media.alt } : { kind: media.kind };
}

function clean(
  input: string,
  options: { multiline: boolean; stripBidi: boolean },
): string {
  let value = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(CONTROL, "");
  if (options.stripBidi) value = value.replace(BIDI, "");
  if (!options.multiline) value = value.replace(/\s+/g, " ");
  return value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(object: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
}

function fail(message: string): never {
  throw new SnapshotError(message);
}
