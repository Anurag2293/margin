import { describe, expect, it } from "vitest";
import { linkify } from "@/lib/linkify";

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
