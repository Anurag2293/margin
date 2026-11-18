import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { classifyImport } from "@/lib/import";
import { canonicalJson } from "@/lib/snapshot";

describe("classifyImport", () => {
  it("reads a snapshot with a BOM and surrounding whitespace", () => {
    const result = classifyImport(`﻿ \n${canonicalJson(EXAMPLE_SNAPSHOT)}\n `);
    expect(result.type).toBe("snapshot");
  });

  it("treats a bare address as url-only and says whether it is X", () => {
    expect(classifyImport("https://x.com/a/status/1")).toEqual({ type: "url-only", url: "https://x.com/a/status/1", x: true });
    expect(classifyImport("twitter.com/a/status/1")).toEqual({ type: "url-only", url: "twitter.com/a/status/1", x: true });
    expect(classifyImport("https://t.co/abc")).toMatchObject({ type: "url-only", x: true });
    expect(classifyImport("  https://example.com/post  ")).toEqual({ type: "url-only", url: "https://example.com/post", x: false });
  });

  it("explains empty and invalid input", () => {
    expect(classifyImport("")).toEqual({ type: "invalid", error: "Paste a snapshot first." });
    expect(classifyImport("﻿   ")).toEqual({ type: "invalid", error: "Paste a snapshot first." });
    expect(classifyImport("hello")).toEqual({ type: "invalid", error: "This is not valid JSON." });
    expect(classifyImport("{}")).toMatchObject({ type: "invalid" });
  });

  it("never throws and always returns one of three kinds", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: "binary" }), fc.json(), fc.webUrl()), (text) => {
        const result = classifyImport(text);
        expect(["snapshot", "url-only", "invalid"]).toContain(result.type);
        if (result.type === "invalid") expect(result.error.length).toBeGreaterThan(0);
      }),
    );
  });
});
