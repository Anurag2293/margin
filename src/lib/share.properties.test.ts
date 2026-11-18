import zlib from "node:zlib";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/limits";
import {
  ShareTooLargeError,
  base64UrlToBytes,
  bytesToBase64Url,
  decodeShareToken,
  encodeShareToken,
  shareHash,
  tokenFromHash,
} from "@/lib/share";
import { canonicalJson, parseSnapshot, type Snapshot } from "@/lib/snapshot";
import { rawSnapshot } from "@/test/arbitraries";

const accepted = rawSnapshot
  .map((raw) => parseSnapshot(JSON.stringify(raw)))
  .filter((parsed): parsed is { ok: true; snapshot: Snapshot } => parsed.ok)
  .map((parsed) => parsed.snapshot);

function deflate(text: string | Buffer): string {
  return zlib.deflateRawSync(typeof text === "string" ? Buffer.from(text, "utf8") : text).toString("base64url");
}

describe("base64url", () => {
  it("roundtrips any bytes and uses only the URL-safe alphabet without padding", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 70_000 }), (bytes) => {
        const token = bytesToBase64Url(bytes);
        expect(token).toMatch(/^[A-Za-z0-9_-]*$/);
        expect(token).toBe(Buffer.from(bytes).toString("base64url"));
        expect(Array.from(base64UrlToBytes(token))).toEqual(Array.from(bytes));
      }),
      { numRuns: 60 },
    );
  });

  it("throws on a length that cannot be base64", () => {
    expect(() => base64UrlToBytes("a")).toThrow();
    expect(() => base64UrlToBytes("abcde")).toThrow();
  });
});

describe("share token properties", () => {
  it("decodes every encoded snapshot back to the same snapshot", async () => {
    await fc.assert(
      fc.asyncProperty(accepted, async (snapshot) => {
        const token = await encodeShareToken(snapshot);
        expect(token.length).toBeLessThanOrEqual(LIMITS.maxShareTokenLength);
        expect(zlib.inflateRawSync(Buffer.from(token, "base64url")).toString("utf8")).toBe(canonicalJson(snapshot));
        expect(await decodeShareToken(token)).toEqual({ ok: true, snapshot });
        expect(tokenFromHash(shareHash(token))).toEqual({ kind: "token", token });
      }),
      { numRuns: 150 },
    );
  });

  it("reads tokens from other raw-deflate producers at any level", async () => {
    await fc.assert(
      fc.asyncProperty(accepted, fc.integer({ min: 0, max: 9 }), async (snapshot, level) => {
        const token = zlib.deflateRawSync(Buffer.from(canonicalJson(snapshot), "utf8"), { level }).toString("base64url");
        expect(await decodeShareToken(token)).toEqual({ ok: true, snapshot });
      }),
      { numRuns: 60 },
    );
  });

  it("never throws on arbitrary text, bytes, or damaged tokens", async () => {
    const valid = deflate(canonicalJson(fc.sample(accepted, { numRuns: 1, seed: 3 })[0]));
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ unit: "binary", maxLength: 300 }),
          fc.string({ unit: fc.constantFrom(..."ABCabc019-_"), maxLength: 300 }),
          fc.uint8Array({ maxLength: 400 }).map((bytes) => Buffer.from(bytes).toString("base64url")),
          fc.nat({ max: valid.length }).map((cut) => valid.slice(0, cut)),
          fc.tuple(fc.nat({ max: valid.length - 1 }), fc.constantFrom(..."AZaz09-_")).map(
            ([at, char]) => `${valid.slice(0, at)}${char}${valid.slice(at + 1)}`,
          ),
        ),
        async (token) => {
          const result = await decodeShareToken(token);
          if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("explains each kind of bad token", async () => {
    expect(await decodeShareToken("")).toEqual({ ok: false, error: "This reader link is empty." });
    expect(await decodeShareToken("abc=")).toEqual({ ok: false, error: "This reader link contains characters Margin does not use." });
    expect(await decodeShareToken("abc+/")).toMatchObject({ ok: false, error: expect.stringContaining("characters") });
    expect(await decodeShareToken("a")).toEqual({ ok: false, error: "This reader link could not be decoded." });
    expect(await decodeShareToken("AAAA")).toMatchObject({ ok: false });
    expect(await decodeShareToken(deflate(Buffer.from([0xff, 0xfe, 0xc3, 0x28])))).toEqual({ ok: false, error: "This reader link did not contain text." });
    expect(await decodeShareToken(deflate("[1,2]"))).toEqual({ ok: false, error: "A snapshot must be a JSON object." });
    const valid = deflate(canonicalJson(fc.sample(accepted, { numRuns: 1, seed: 5 })[0]));
    expect(await decodeShareToken(valid.slice(0, -6))).toMatchObject({ ok: false });
  });

  it("stops unpacking at 48 KB, even for a tiny token", async () => {
    const bomb = deflate(Buffer.alloc(10 * 1024 * 1024, 0x20));
    expect(bomb.length).toBeLessThan(LIMITS.maxShareTokenLength);
    expect(await decodeShareToken(bomb)).toEqual({ ok: false, error: "This link unpacks to more than 48 KB." });
    const exact = deflate(Buffer.alloc(LIMITS.maxBytes, 0x20));
    expect(await decodeShareToken(exact)).toEqual({ ok: false, error: "This is not valid JSON." });
  });

  it("refuses to encode a snapshot whose link would be too long", async () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    const text = Array.from({ length: 11_000 }, () => String.fromCodePoint(0x4e00 + (random() % 20_000))).join("");
    const snapshot: Snapshot = { format: "single-post-snapshot", version: 1, post: { authorName: "A", authorHandle: "a", text } };
    expect(new TextEncoder().encode(canonicalJson(snapshot)).byteLength).toBeLessThanOrEqual(LIMITS.maxBytes);
    await expect(encodeShareToken(snapshot)).rejects.toBeInstanceOf(ShareTooLargeError);
    const over: Snapshot = { ...snapshot, post: { ...snapshot.post, text: "日".repeat(12_000), quote: { authorName: "Q", authorHandle: "q", text: "日".repeat(5_000) } } };
    await expect(encodeShareToken(over)).rejects.toBeInstanceOf(ShareTooLargeError);
  });
});

describe("tokenFromHash", () => {
  it.each([
    ["", { kind: "empty" }],
    ["#", { kind: "empty" }],
    ["#s1.", { kind: "token", token: "" }],
    ["s1.abc", { kind: "token", token: "abc" }],
    ["#%73%31.abc", { kind: "token", token: "abc" }],
    ["#s1.ab%2Dc", { kind: "token", token: "ab-c" }],
    ["#s1.%E0%A4%A", { kind: "token", token: "%E0%A4%A" }],
    ["#S1.abc", { kind: "foreign", raw: "S1.abc" }],
    ["#s2.abc", { kind: "foreign", raw: "s2.abc" }],
    ["#content", { kind: "foreign", raw: "content" }],
    ["#https%3A%2F%2Fx.com%2Fa%2Fstatus%2F1", { kind: "foreign", raw: "https://x.com/a/status/1" }],
  ])("reads %j", (hash, expected) => {
    expect(tokenFromHash(hash)).toEqual(expected);
  });

  it("never throws", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (hash) => {
        expect(["empty", "token", "foreign"]).toContain(tokenFromHash(hash).kind);
      }),
    );
  });
});
