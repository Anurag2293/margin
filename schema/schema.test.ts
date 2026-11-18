import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { canonicalJson, parseSnapshot } from "@/lib/snapshot";
import { rawSnapshot } from "@/test/arbitraries";

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "single-post-snapshot.v1.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

function base(post: Record<string, unknown> = {}) {
  return {
    format: "single-post-snapshot",
    version: 1,
    post: { authorName: "Ada", authorHandle: "ada", text: "Hello", ...post },
  };
}

describe("snapshot JSON Schema", () => {
  it("accepts the built-in example and the README example", () => {
    expect(validate(JSON.parse(canonicalJson(EXAMPLE_SNAPSHOT))), JSON.stringify(validate.errors)).toBe(true);
    const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
    const block = readme.match(/## Snapshot format[\s\S]*?```json\n([\s\S]*?)```/)?.[1];
    expect(block).toBeTruthy();
    const example = JSON.parse(block!);
    example.post.profile.avatar = "data:image/jpeg;base64,/9j/4AAQ";
    expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
    expect(parseSnapshot(JSON.stringify(example)).ok).toBe(true);
  });

  it("accepts everything the reader produces", () => {
    fc.assert(
      fc.property(rawSnapshot, (raw) => {
        const parsed = parseSnapshot(JSON.stringify(raw));
        if (!parsed.ok) return;
        const canonical = JSON.parse(canonicalJson(parsed.snapshot));
        expect(validate(canonical), JSON.stringify(validate.errors)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("rejects the structural mistakes the reader rejects", () => {
    const quote = { authorName: "Q", authorHandle: "q", text: "t" };
    const cases: Array<[string, unknown]> = [
      ["version as text", { ...base(), version: "1" }],
      ["wrong format", { ...base(), format: "post" }],
      ["missing post", { format: "single-post-snapshot", version: 1 }],
      ["bad handle", base({ authorHandle: "has space" })],
      ["long name", base({ authorName: "a".repeat(51) })],
      ["long text", base({ text: "a".repeat(12_001) })],
      ["date without time", base({ createdAt: "2026-04-02" })],
      ["five media", base({ media: Array.from({ length: 5 }, () => ({ kind: "photo" })) })],
      ["unknown media kind", base({ media: [{ kind: "image" }] })],
      ["nested quote", base({ quote: { ...quote, quote } })],
      ["quote date without time", base({ quote: { ...quote, createdAt: "yesterday" } })],
      ["remote avatar", base({ profile: { avatar: "https://example.com/a.png" } })],
      ["negative followers", base({ profile: { followers: -1 } })],
      ["http website", base({ profile: { website: "http://example.com" } })],
      ...["url", "src", "href", "source", "previewUrl", "poster"].map(
        (key): [string, unknown] => [`media ${key}`, base({ media: [{ kind: "photo", [key]: "https://example.com/a.jpg" }] })],
      ),
    ];
    for (const [name, snapshot] of cases) {
      expect(parseSnapshot(JSON.stringify(snapshot)).ok, `reader: ${name}`).toBe(false);
      expect(validate(snapshot), `schema: ${name}`).toBe(false);
    }
  });
});
