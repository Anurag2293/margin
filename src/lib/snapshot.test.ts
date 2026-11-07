import { describe, expect, it } from "vitest";
import { classifyImport } from "@/lib/import";
import { LIMITS } from "@/lib/limits";
import { canonicalJson, parseSnapshot, prettyJson } from "@/lib/snapshot";

function snapshot(post: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: "single-post-snapshot",
    version: 1,
    ...extra,
    post: {
      authorName: "Ada M. Example",
      authorHandle: "ada_example",
      text: "Hello",
      ...post,
    },
  });
}

describe("parseSnapshot", () => {
  it("keeps multiline unicode text, a quote, and media descriptions", () => {
    const parsed = parseSnapshot(
      snapshot({
        text: "Line one 🌱\n\n日本語 — café “quotes”",
        createdAt: "2026-01-15T18:04:00.000Z",
        sourceUrl: "https://x.com/ada_example/status/99?s=20",
        lang: "ja",
        quote: {
          authorName: "Quoted Poet",
          authorHandle: "@poet_example",
          text: "A quoted line\nwith café",
          createdAt: "2026-01-14T08:00:00+00:00",
        },
        media: [
          { kind: "photo", alt: "Window light" },
          { kind: "video", alt: "Rain" },
        ],
        ignored: "drop me",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.post.text).toBe("Line one 🌱\n\n日本語 — café “quotes”");
    expect(parsed.snapshot.post.authorHandle).toBe("ada_example");
    expect(parsed.snapshot.post.sourceUrl).toBe("https://x.com/ada_example/status/99");
    expect(parsed.snapshot.post.quote?.authorHandle).toBe("poet_example");
    expect(parsed.snapshot.post.quote?.text).toContain("\n");
    expect(parsed.snapshot.post.media?.map((item) => item.kind)).toEqual(["photo", "video"]);
    expect(canonicalJson(parsed.snapshot)).not.toContain("ignored");
    expect(prettyJson(parsed.snapshot)).toContain("Window light");
  });

  it("canonicalizes twitter and mobile status URLs and drops photo suffixes", () => {
    const parsed = parseSnapshot(
      snapshot({
        sourceUrl: "https://mobile.twitter.com/ada_example/status/42/photo/1",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.post.sourceUrl).toBe("https://twitter.com/ada_example/status/42");
  });

  it("allows an empty body only when media is described", () => {
    const withMedia = parseSnapshot(snapshot({ text: "", media: [{ kind: "gif" }] }));
    expect(withMedia.ok).toBe(true);
    const without = parseSnapshot(snapshot({ text: "   " }));
    expect(without.ok).toBe(false);
    if (!without.ok) expect(without.error).toContain("empty");
  });

  it("rejects invalid, nested, hostile, and oversized snapshots", () => {
    expect(parseSnapshot("{").ok).toBe(false);
    expect(parseSnapshot("[]").ok).toBe(false);

    const version = parseSnapshot(snapshot({}, { version: 2 }));
    expect(version.ok).toBe(false);
    if (!version.ok) expect(version.error).toContain("version must be 1");

    const nested = parseSnapshot(
      snapshot({
        quote: {
          authorName: "Quoted Poet",
          authorHandle: "poet_example",
          text: "Inner",
          quote: { authorName: "Nope", authorHandle: "nope", text: "Deeper" },
        },
      }),
    );
    expect(nested.ok).toBe(false);
    if (!nested.ok) expect(nested.error).toContain("another quote");

    const script = parseSnapshot(snapshot({ sourceUrl: "javascript:alert(1)" }));
    expect(script.ok).toBe(false);
    if (!script.ok) expect(script.error).toContain("sourceUrl");

    const lookalike = parseSnapshot(
      snapshot({ sourceUrl: "https://x.com.evil.com/ada_example/status/1" }),
    );
    expect(lookalike.ok).toBe(false);

    const mediaUrl = parseSnapshot(
      snapshot({ media: [{ kind: "photo", src: "https://pbs.twimg.com/media/a.jpg" }] }),
    );
    expect(mediaUrl.ok).toBe(false);
    if (!mediaUrl.ok) expect(mediaUrl.error).toContain("does not load");

    const handle = parseSnapshot(snapshot({ authorHandle: "has space" }));
    expect(handle.ok).toBe(false);

    const longText = parseSnapshot(snapshot({ text: "a".repeat(LIMITS.maxText + 1) }));
    expect(longText.ok).toBe(false);
    if (!longText.ok) expect(longText.error).toContain("12,000");

    const bytes = Buffer.alloc(LIMITS.maxBytes + 1, 0x20).toString("utf8");
    const oversize = parseSnapshot(bytes);
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) expect(oversize.error).toContain("48 KB");
  });

  it("strips control characters and bidi overrides from the name", () => {
    const parsed = parseSnapshot(
      snapshot({
        authorName: "Ada\u202e\u0000 Example",
        text: "Keep\u0000this",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.post.authorName).toBe("Ada Example");
    expect(parsed.snapshot.post.text).toBe("Keepthis");
  });
});

describe("classifyImport", () => {
  it("does not treat an X address as content", () => {
    const result = classifyImport("https://x.com/someone/status/42");
    expect(result.type).toBe("url-only");
    if (result.type === "url-only") expect(result.x).toBe(true);
  });

  it("does not treat an ordinary URL as content", () => {
    const result = classifyImport("https://example.com/essay");
    expect(result).toMatchObject({ type: "url-only", x: false });
  });

  it("asks for a snapshot when the box is empty", () => {
    expect(classifyImport("  ")).toMatchObject({ type: "invalid" });
  });
});
