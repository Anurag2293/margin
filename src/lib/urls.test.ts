import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalStatusUrl, isXFamilyUrl, looksLikeBareUrl } from "@/lib/urls";
import { HOSTILE } from "@/test/arbitraries";

const CANONICAL = /^https:\/\/(x\.com|twitter\.com)\/(?:[A-Za-z0-9_]{1,15}\/status|i\/web\/status)\/\d{1,20}$/;

describe("canonicalStatusUrl", () => {
  it.each([
    ["https://x.com/ada/status/123", "https://x.com/ada/status/123"],
    ["https://www.x.com/ada/status/123/", "https://x.com/ada/status/123"],
    ["  https://X.COM/ada/status/123?s=20#frag  ", "https://x.com/ada/status/123"],
    ["https://mobile.twitter.com/ada/status/123/photo/1", "https://twitter.com/ada/status/123"],
    ["https://www.twitter.com/ada/status/123/video/2", "https://twitter.com/ada/status/123"],
    ["https://x.com/i/web/status/9", "https://x.com/i/web/status/9"],
    ["https://x.com:443/ada/status/1", "https://x.com/ada/status/1"],
  ])("canonicalizes %s", (input, expected) => {
    expect(canonicalStatusUrl(input)).toBe(expected);
  });

  it.each([
    "http://x.com/ada/status/1",
    "https://x.com:8443/ada/status/1",
    "https://user@x.com/ada/status/1",
    "https://user:pw@x.com/ada/status/1",
    "https://evil.example/ada/status/1",
    "https://x.com.evil.example/ada/status/1",
    "https://api.x.com/ada/status/1",
    "https://t.co/abc",
    "https://x.com/ada",
    "https://x.com/ada/status/",
    "https://x.com/ada/status/abc",
    "https://x.com/this_is_too_long_handle/status/1",
    `https://x.com/ada/status/${"1".repeat(21)}`,
    "https://x.com\\ada/status/1",
    "https://x.com/ada/\nstatus/1",
    "https://x.com/ada/status/1\u0000",
    "javascript:alert(1)//https://x.com/ada/status/1",
    "x.com/ada/status/1",
    "",
    `https://x.com/ada/status/1?${"a".repeat(600)}`,
  ])("rejects %j", (input) => {
    expect(canonicalStatusUrl(input)).toBeNull();
  });

  it("rejects a non-string at runtime", () => {
    expect(canonicalStatusUrl(42 as unknown as string)).toBeNull();
    expect(canonicalStatusUrl(null as unknown as string)).toBeNull();
  });

  it("returns only canonical URLs, and is idempotent", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.webUrl({ withFragments: true, withQueryParameters: true }), fc.string({ unit: "binary" }), fc.constantFrom(...HOSTILE)),
        (input) => {
          const out = canonicalStatusUrl(input);
          if (out === null) return;
          expect(out).toMatch(CANONICAL);
          expect(canonicalStatusUrl(out)).toBe(out);
        },
      ),
    );
  });

  it("keeps the handle and the id of any status URL", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"),
        fc.stringMatching(/^[A-Za-z0-9_]{1,15}$/),
        fc.stringMatching(/^\d{1,20}$/),
        fc.constantFrom("", "/", "?s=20", "#x", "/photo/1", "/analytics"),
        (host, user, id, suffix) => {
          const out = canonicalStatusUrl(`https://${host}/${user}/status/${id}${suffix}`);
          const root = host.endsWith("twitter.com") ? "twitter.com" : "x.com";
          expect(out).toBe(`https://${root}/${user}/status/${id}`);
        },
      ),
    );
  });
});

describe("looksLikeBareUrl", () => {
  it("recognizes addresses with or without a scheme", () => {
    for (const text of ["https://example.com", "http://example.com/a", "x.com/a/status/1", "  www.twitter.com/a  ", "HTTPS://X.COM"]) {
      expect(looksLikeBareUrl(text), text).toBe(true);
    }
  });

  it("rejects text, JSON, whitespace inside, and very long input", () => {
    for (const text of ["", "hello", "{\"a\":1}", "https://example.com and more", "example.com/a", `https://${"a".repeat(2_000)}`]) {
      expect(looksLikeBareUrl(text), text.slice(0, 40)).toBe(false);
    }
  });
});

describe("isXFamilyUrl", () => {
  it("knows X, Twitter, and t.co addresses", () => {
    for (const text of ["https://x.com/a", "x.com/a/status/1", "https://mobile.twitter.com/a", "http://t.co/abc", "https://WWW.X.COM"]) {
      expect(isXFamilyUrl(text), text).toBe(true);
    }
  });

  it("does not claim other hosts or unparseable text", () => {
    for (const text of ["https://example.com", "https://notx.com", "https://x.com.evil.example", "https://", "not a url"]) {
      expect(isXFamilyUrl(text), text).toBe(false);
    }
  });

  it("never throws", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        expect(typeof isXFamilyUrl(text)).toBe("boolean");
        expect(typeof looksLikeBareUrl(text)).toBe("boolean");
      }),
    );
  });
});
