import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { LIMITS } from "@/lib/limits";
import { canonicalJson, parseSnapshot, prettyJson, toCanonical, type Post, type Snapshot } from "@/lib/snapshot";
import { rawSnapshot } from "@/test/arbitraries";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\r]/;
const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

function build(post: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: "single-post-snapshot",
    version: 1,
    ...extra,
    post: { authorName: "Ada", authorHandle: "ada", text: "Hello", ...post },
  });
}

function accepted(post: Record<string, unknown>, extra: Record<string, unknown> = {}): Snapshot {
  const parsed = parseSnapshot(build(post, extra));
  if (!parsed.ok) throw new Error(`expected a valid snapshot, got: ${parsed.error}`);
  return parsed.snapshot;
}

function rejected(post: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  const parsed = parseSnapshot(build(post, extra));
  if (parsed.ok) throw new Error(`expected a rejection for ${JSON.stringify(post).slice(0, 200)}`);
  return parsed.error;
}

function checkPost(post: Post) {
  expect(post.authorName.length).toBeGreaterThan(0);
  expect(post.authorName.length).toBeLessThanOrEqual(LIMITS.maxName);
  expect(post.authorName).not.toMatch(CONTROL);
  expect(post.authorName).not.toMatch(BIDI);
  expect(post.authorName).toBe(post.authorName.trim());
  expect(post.authorHandle).toMatch(/^[A-Za-z0-9_]{1,15}$/);
  expect(post.text.length).toBeLessThanOrEqual(LIMITS.maxText);
  expect(post.text).not.toMatch(CONTROL);
  expect(post.text).toBe(post.text.trim());
  if (!post.text) expect(post.media?.length).toBeGreaterThan(0);
  expect((post.media ?? []).length).toBeLessThanOrEqual(LIMITS.maxMedia);
  for (const item of post.media ?? []) {
    expect(Object.keys(item).sort()).toEqual(item.alt ? ["alt", "kind"] : ["kind"]);
  }
  if (post.sourceUrl) expect(post.sourceUrl).toMatch(/^https:\/\/(x|twitter)\.com\//);
}

describe("parseSnapshot properties", () => {
  it("never throws on any string or JSON value", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: "binary" }), fc.json({ maxDepth: 4 }), rawSnapshot.map((raw) => JSON.stringify(raw))), (text) => {
        const parsed = parseSnapshot(text);
        if (!parsed.ok) expect(parsed.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it("only accepts snapshots that keep every documented rule", () => {
    fc.assert(
      fc.property(rawSnapshot, (raw) => {
        const parsed = parseSnapshot(JSON.stringify(raw));
        if (!parsed.ok) return;
        checkPost(parsed.snapshot.post);
        if (parsed.snapshot.post.quote) checkPost(parsed.snapshot.post.quote);
        expect(Object.keys(parsed.snapshot).sort()).toEqual(
          parsed.snapshot.example ? ["example", "format", "post", "version"] : ["format", "post", "version"],
        );
      }),
      { numRuns: 400 },
    );
  });

  it("accepts most generated snapshots, so the other properties are not vacuous", () => {
    const samples = fc.sample(rawSnapshot, { numRuns: 300, seed: 7 });
    const ok = samples.filter((raw) => parseSnapshot(JSON.stringify(raw)).ok).length;
    expect(ok).toBeGreaterThan(150);
  });

  it("is a fixed point: parsing canonical or pretty JSON gives the same snapshot back", () => {
    fc.assert(
      fc.property(rawSnapshot, (raw) => {
        const first = parseSnapshot(JSON.stringify(raw));
        if (!first.ok) return;
        const again = parseSnapshot(canonicalJson(first.snapshot));
        const pretty = parseSnapshot(prettyJson(first.snapshot));
        expect(again).toEqual(first);
        expect(pretty).toEqual(first);
        expect(canonicalJson(toCanonical(first.snapshot))).toBe(canonicalJson(first.snapshot));
      }),
      { numRuns: 400 },
    );
  });

  it("keeps hostile body text exactly, as text", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "<script>alert(1)</script>",
          "<img src=x onerror=alert(1)>",
          "javascript:alert(1)",
          "\"},\"example\":true,\"x\":{\"",
          "\u202Eevil\u202C",
          "line\nbreak\n\nparagraph",
          "a\u2028b\u2029c",
          "café 日本語 🌳 👩🏽\u200D💻",
        ),
        (text) => {
          expect(accepted({ text }).post.text).toBe(text);
        },
      ),
    );
  });

  it("does not let __proto__ keys supply or pollute fields", () => {
    const viaProto = parseSnapshot(
      '{"format":"single-post-snapshot","version":1,"__proto__":{"post":{"authorName":"A","authorHandle":"a","text":"t"}}}',
    );
    expect(viaProto).toEqual({ ok: false, error: "post is missing." });
    const inherited = parseSnapshot(
      '{"format":"single-post-snapshot","version":1,"post":{"__proto__":{"authorName":"A","authorHandle":"a","text":"t"}}}',
    );
    expect(inherited.ok).toBe(false);
    accepted({ __proto__: { polluted: true } } as Record<string, unknown>);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops fields it does not know and never carries them to canonical JSON", () => {
    const out = canonicalJson(accepted({ tracking: "nope", media: [{ kind: "photo", extra: 1 }] }, { tracking: "nope" }));
    expect(out).not.toContain("tracking");
    expect(out).not.toContain("extra");
  });
});

describe("snapshot limits", () => {
  it("measures names in UTF-16 units after cleaning", () => {
    expect(accepted({ authorName: "a".repeat(50) }).post.authorName).toHaveLength(50);
    expect(rejected({ authorName: "a".repeat(51) })).toContain("longer than 50");
    expect(accepted({ authorName: `  ${"a".repeat(50)}  ` }).post.authorName).toHaveLength(50);
    expect(rejected({ authorName: "🌳".repeat(26) })).toContain("longer than 50");
    expect(accepted({ authorName: "Ada\t\n  Lovelace" }).post.authorName).toBe("Ada Lovelace");
    expect(rejected({ authorName: "\u202E\u0000 " })).toContain("empty");
    expect(rejected({ authorName: 5 })).toContain("must be text");
  });

  it("accepts handles with one @ and the documented characters only", () => {
    expect(accepted({ authorHandle: "@ada_1" }).post.authorHandle).toBe("ada_1");
    expect(accepted({ authorHandle: "a".repeat(15) }).post.authorHandle).toHaveLength(15);
    for (const handle of ["", "@", "@@ada", "a".repeat(16), "ada-1", "ada.1", "ａｄａ", "adá"]) {
      expect(rejected({ authorHandle: handle }), handle).toContain("authorHandle");
    }
  });

  it("counts text after newline normalization and control stripping", () => {
    expect(accepted({ text: "a".repeat(12_000) }).post.text).toHaveLength(12_000);
    expect(accepted({ text: "a\r\n".repeat(6_000) }).post.text).toHaveLength(11_999);
    expect(accepted({ text: `${"a".repeat(12_000)}\u0000\u0001` }).post.text).toHaveLength(12_000);
    expect(rejected({ text: "a".repeat(12_001) })).toContain("12,000");
    expect(rejected({ text: undefined })).toContain("missing");
    expect(rejected({ text: null })).toContain("must be text");
  });

  it("allows four media items and alt text up to 1,000 characters", () => {
    const four = Array.from({ length: 4 }, () => ({ kind: "audio", alt: "a".repeat(1_000) }));
    expect(accepted({ media: four }).post.media).toHaveLength(4);
    expect(rejected({ media: [...four, { kind: "photo" }] })).toContain("at most 4");
    expect(rejected({ media: [{ kind: "photo", alt: "a".repeat(1_001) }] })).toContain("1,000");
    expect(rejected({ media: [{ kind: "image" }] })).toContain("kind must be");
    expect(rejected({ media: {} })).toContain("must be an array");
    expect(rejected({ media: [null] })).toContain("must be a JSON object");
    expect(accepted({ media: [{ kind: "photo", alt: "   " }] }).post.media).toEqual([{ kind: "photo" }]);
  });

  it("rejects every media URL key unless it is null", () => {
    for (const key of ["url", "src", "href", "source", "previewUrl", "poster"]) {
      expect(rejected({ media: [{ kind: "photo", [key]: "https://example.com/a.jpg" }] }), key).toContain("cannot include a URL");
      expect(rejected({ media: [{ kind: "photo", [key]: "" }] }), key).toContain("cannot include a URL");
      expect(accepted({ media: [{ kind: "photo", [key]: null }] }).post.media).toEqual([{ kind: "photo" }]);
    }
  });

  it("measures the whole input in UTF-8 bytes, without the BOM", () => {
    const base = build({ text: "x" });
    const pad = LIMITS.maxBytes - Buffer.byteLength(base);
    const exact = `${base}${" ".repeat(pad)}`;
    expect(Buffer.byteLength(exact)).toBe(LIMITS.maxBytes);
    expect(parseSnapshot(exact).ok).toBe(true);
    expect(parseSnapshot(`\uFEFF${exact}`).ok).toBe(true);
    expect(parseSnapshot(`${exact} `).ok).toBe(false);
  });

  it("checks the language tag and createdAt shape", () => {
    expect(accepted({ lang: " pt-BR " }).post.lang).toBe("pt-BR");
    for (const lang of ["e", "english", "en_US", "en-", "<b>", ""]) expect(rejected({ lang }), lang).toContain("lang");
    expect(accepted({ createdAt: " 2026-04-02T16:30:00+09:00 " }).post.createdAt).toBe("2026-04-02T16:30:00+09:00");
    for (const createdAt of ["2026-04-02", "2026-04-02 16:30:00Z", "2026-04-02T16:30Z", "2026-13-02T16:30:00Z", "", 1712075400000]) {
      expect(rejected({ createdAt }), String(createdAt)).toContain("createdAt");
    }
  });

  it("requires format, version 1 as a number, and a boolean example", () => {
    expect(parseSnapshot(JSON.stringify({ format: "single-post-snapshot", version: "1", post: {} }))).toEqual({ ok: false, error: "version must be 1." });
    expect(parseSnapshot(JSON.stringify({ format: "other", version: 1, post: {} }))).toEqual({ ok: false, error: "format must be single-post-snapshot." });
    expect(rejected({}, { example: "yes" })).toContain("example");
    expect(accepted({}, { example: false }).example).toBeUndefined();
    expect(rejected({ quote: null })).toContain("quote must be a JSON object");
    expect(parseSnapshot("null")).toEqual({ ok: false, error: "A snapshot must be a JSON object." });
  });
});

describe("profile limits", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";

  it("accepts an avatar data URI up to 20,000 characters and rejects remote or odd ones", () => {
    const body = "A".repeat(LIMITS.maxAvatar - "data:image/png;base64,".length);
    expect(accepted({ profile: { avatar: `data:image/png;base64,${body}` } }).post.profile?.avatar).toHaveLength(20_000);
    expect(rejected({ profile: { avatar: `data:image/png;base64,${body}A` } })).toContain("20,000");
    for (const avatar of [
      "https://pbs.twimg.com/profile_images/a.jpg",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png,rawdata",
      "data:image/gif;base64,R0lGOD==",
      "data:image/png;base64,",
      "data:image/png;base64,abc===",
      "data:image/png;base64,ab cd",
      "javascript:alert(1)",
    ]) {
      expect(rejected({ profile: { avatar } }), avatar).toContain("avatar");
    }
    expect(accepted({ profile: { avatar: ` ${png} ` } }).post.profile?.avatar).toBe(png);
  });

  it("keeps bio line breaks, flattens location, and enforces both lengths", () => {
    const profile = accepted({ profile: { bio: "one\r\ntwo", location: "Tokyo\n\u202EJapan" } }).post.profile;
    expect(profile).toEqual({ bio: "one\ntwo", location: "Tokyo Japan" });
    expect(rejected({ profile: { bio: "a".repeat(501) } })).toContain("bio");
    expect(rejected({ profile: { location: "a".repeat(101) } })).toContain("location");
    expect(accepted({ profile: { bio: "  ", location: "" } }).post.profile).toBeUndefined();
  });

  it("only accepts plain https websites", () => {
    expect(accepted({ profile: { website: "https://example.com/a?b=c" } }).post.profile?.website).toBe("https://example.com/a?b=c");
    for (const website of [
      "http://example.com",
      "javascript:alert(1)",
      "https://user@example.com",
      "https://example.com:8080",
      "https://exa mple.com",
      "https://example.com\\@evil",
      `https://example.com/${"a".repeat(300)}`,
      "example.com",
    ]) {
      expect(rejected({ profile: { website } }), website).toContain("website");
    }
  });

  it("accepts the documented joinedAt forms", () => {
    for (const joinedAt of ["2014-03", "2014-03-21", "2014-03-21T10:00:00Z", "2014-03-21T10:00:00.5+09:00"]) {
      expect(accepted({ profile: { joinedAt } }).post.profile?.joinedAt, joinedAt).toBe(joinedAt);
    }
    for (const joinedAt of ["2014", "2014-3", "2014-13", "March 2014", "2014-03-21T10:00", ""]) {
      expect(rejected({ profile: { joinedAt } }), joinedAt).toContain("joinedAt");
    }
  });

  it("accepts whole counts from 0 to 1e12 only", () => {
    expect(accepted({ profile: { followers: 0, following: 1e12, posts: 5 } }).post.profile).toEqual({ followers: 0, following: 1e12, posts: 5 });
    for (const followers of [-1, 1.5, 1e12 + 1, "10", true, null]) {
      expect(rejected({ profile: { followers } }), String(followers)).toContain("whole number");
    }
    expect(parseSnapshot(build({}).replace('"text":"Hello"', '"text":"Hello","profile":{"posts":1e400}')).ok).toBe(false);
  });

  it("drops a null profile and rejects other non-objects", () => {
    expect(accepted({ profile: null }).post.profile).toBeUndefined();
    expect(rejected({ profile: [] })).toContain("profile must be a JSON object");
    expect(rejected({ profile: "x" })).toContain("profile must be a JSON object");
    expect(rejected({ profile: { verified: "true" } })).toContain("verified");
  });
});

describe("example snapshot", () => {
  it("parses to itself", () => {
    expect(parseSnapshot(canonicalJson(EXAMPLE_SNAPSHOT))).toEqual({ ok: true, snapshot: toCanonical(EXAMPLE_SNAPSHOT) });
  });
});

describe("calendar dates", () => {
  it("rejects createdAt days and hours that do not exist instead of rolling them over", () => {
    for (const createdAt of [
      "2026-02-29T10:00:00Z",
      "2026-02-30T10:00:00Z",
      "2026-04-31T10:00:00Z",
      "2026-01-01T24:00:00Z",
    ]) {
      expect(rejected({ createdAt }), createdAt).toContain("createdAt");
      expect(rejected({ quote: { authorName: "Q", authorHandle: "q", text: "t", createdAt } }), createdAt).toContain("createdAt");
    }
    expect(accepted({ createdAt: "2024-02-29T23:59:59.999Z" }).post.createdAt).toBe("2024-02-29T23:59:59.999Z");
  });

  it("rejects joinedAt days that do not exist", () => {
    for (const joinedAt of ["2014-02-30", "2014-06-31", "2014-02-30T10:00:00Z"]) {
      expect(rejected({ profile: { joinedAt } }), joinedAt).toContain("joinedAt");
    }
    expect(accepted({ profile: { joinedAt: "2016-02-29" } }).post.profile?.joinedAt).toBe("2016-02-29");
  });

  it("accepts every real instant written by toISOString", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("1000-01-01T00:00:00Z"), max: new Date("9999-12-31T23:59:59Z"), noInvalidDate: true }), (date) => {
        const createdAt = date.toISOString();
        expect(accepted({ createdAt }).post.createdAt).toBe(createdAt);
      }),
    );
  });
});
