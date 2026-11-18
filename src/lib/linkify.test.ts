import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isBlockedHost } from "@/lib/hosts";
import { linkify } from "@/lib/linkify";
import { hostileText } from "@/test/arbitraries";

function hrefs(text: string): string[] {
  return linkify(text).flatMap((part) => (part.type === "link" ? [part.href] : []));
}

describe("linkify", () => {
  it("links ordinary https URLs and leaves punctuation outside the href", () => {
    const parts = linkify("Read https://example.com/field-notes?q=1.");
    const link = parts.find((part) => part.type === "link");
    expect(link).toMatchObject({
      type: "link",
      href: "https://example.com/field-notes?q=1",
      value: "https://example.com/field-notes?q=1",
    });
    expect(parts.at(-1)).toMatchObject({ type: "text", value: "." });
  });

  it("keeps X, t.co, and twimg addresses as text", () => {
    const text = [
      "https://x.com/someone/status/1",
      "https://www.twitter.com/someone/status/1",
      "https://t.co/abcXYZ",
      "https://pbs.twimg.com/media/abc.jpg",
      "https://video.twimg.com/ext_tw_video/1.mp4",
    ].join(" ");
    const parts = linkify(text);
    expect(parts.filter((part) => part.type === "link")).toHaveLength(0);
    expect(parts.filter((part) => part.type === "blocked").length).toBe(5);
    expect(hrefs(text)).toEqual([]);
  });

  it("does not turn javascript, credentials, odd ports, or markup into links", () => {
    const text = [
      "javascript:alert(1)",
      "https://user:pass@example.com/secret",
      "https://evil.example:444/phish",
      "<img src=x onerror=alert(1)>",
      "<script>alert(1)</script>",
      'https://example.com/"onclick=alert(1)',
    ].join("\n");
    const links = hrefs(text);
    expect(links).toEqual(["https://example.com/"]);
    for (const href of links) {
      expect(href.startsWith("https://")).toBe(true);
      expect(href).not.toMatch(/javascript:|x\.com|twitter\.com|t\.co|twimg\.com|onclick|alert/i);
    }
  });

  it("still links hosts that only resemble blocked names", () => {
    expect(hrefs("https://notx.com/a and https://example.com/t.co/x")).toEqual([
      "https://notx.com/a",
      "https://example.com/t.co/x",
    ]);
  });

  it("preserves multiline unicode around a link", () => {
    const text = "café 日本語\nhttps://example.com/a\n🌳";
    const joined = linkify(text).map((part) => part.value).join("");
    expect(joined).toBe(text);
  });
});

describe("linkify properties", () => {
  const anyText = fc.oneof(hostileText(20), fc.string({ unit: "binary", maxLength: 200 }));

  it("never drops, duplicates, or reorders text", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        const parts = linkify(text);
        expect(parts.map((part) => part.value).join("")).toBe(text);
        for (const part of parts) expect(part.value.length).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it("only links default-port https URLs to hosts that are not blocked, with the host as written", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        for (const part of linkify(text)) {
          if (part.type === "link") {
            const url = new URL(part.href);
            expect(url.protocol).toBe("https:");
            expect(url.username + url.password + url.port).toBe("");
            expect(isBlockedHost(url.hostname)).toBe(false);
            expect(part.href).not.toMatch(/[\s"'<>`]/);
            expect(part.value.slice(0, 8).toLowerCase()).toBe("https://");
            expect(part.value.slice(8).toLowerCase().startsWith(url.hostname)).toBe(true);
          }
          if (part.type === "blocked") {
            expect(isBlockedHost(new URL(part.value).hostname)).toBe(true);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("links a linked value the same way when it stands alone", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        for (const part of linkify(text)) {
          if (part.type !== "link") continue;
          expect(linkify(part.value)).toEqual([part]);
        }
      }),
    );
  });

  it("keeps closing brackets and punctuation outside the link unless they are balanced", () => {
    expect(hrefs("(see https://example.com/a_(b))")).toEqual(["https://example.com/a_(b)"]);
    expect(hrefs("[https://example.com/x]")).toEqual(["https://example.com/x"]);
    expect(hrefs("https://example.com/x?!.")).toEqual(["https://example.com/x"]);
    const parts = linkify("Go (https://example.com/a).");
    expect(parts.map((part) => part.value)).toEqual(["Go (", "https://example.com/a", ")."]);
  });

  it("trims closing brackets and punctuation in any order after a link", () => {
    expect(hrefs("[see (https://example.com/a)]")).toEqual(["https://example.com/a"]);
    expect(hrefs("(https://example.com/a_(b))]")).toEqual(["https://example.com/a_(b)"]);
    expect(hrefs("(see https://example.com/a.)")).toEqual(["https://example.com/a"]);
    expect(hrefs("[https://example.com/a].")).toEqual(["https://example.com/a"]);
    expect(linkify("[see (https://example.com/a)]").map((part) => part.value)).toEqual(["[see (", "https://example.com/a", ")]"]);
  });

  it("does not link lookalike hosts written with other dots, percent escapes, or IDN", () => {
    expect(hrefs("https://exa。mple.com/ https://%78.com/a https://例え.jp/ https://0x7f.1/")).toEqual([]);
    expect(linkify("HTTPS://X.COM/a/status/1")[0].type).toBe("blocked");
    expect(linkify("https://x.com。evil.example/")[0].type).not.toBe("link");
  });

  it("handles 12,000 closing brackets in linear time", () => {
    for (const tail of [")", "]"]) {
      const text = `https://example.com/${tail.repeat(11_980)}`;
      const started = performance.now();
      const parts = linkify(text);
      const elapsed = performance.now() - started;
      expect(parts.map((part) => part.value).join("")).toBe(text);
      expect(elapsed).toBeLessThan(100);
    }
  });
});
