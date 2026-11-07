import { execFileSync, spawnSync } from "node:child_process";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { LIMITS } from "@/lib/limits";
import {
  base64UrlToBytes,
  decodeShareToken,
  encodeShareToken,
  shareHash,
  tokenFromHash,
} from "@/lib/share";
import { canonicalJson, parseSnapshot, type Snapshot } from "@/lib/snapshot";

const rich: Snapshot = {
  format: "single-post-snapshot",
  version: 1,
  post: {
    authorName: "Ada M. Example",
    authorHandle: "ada_example",
    text: "Line one 🌱\n\n日本語 — café",
    createdAt: "2026-01-15T18:04:00.000Z",
    sourceUrl: "https://x.com/ada_example/status/99",
    quote: {
      authorName: "Quoted Poet",
      authorHandle: "poet_example",
      text: "A quoted line\nwith café",
    },
    media: [{ kind: "photo", alt: "Window light" }],
  },
};

describe("share tokens", () => {
  it("roundtrips through raw deflate and preserves unicode", async () => {
    const token = await encodeShareToken(rich);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(shareHash(token)).toBe(`#s1.${token}`);
    const inflated = zlib.inflateRawSync(base64UrlToBytes(token)).toString("utf8");
    expect(inflated).toBe(canonicalJson(rich));
    const decoded = await decodeShareToken(token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.post.text).toBe(rich.post.text);
    expect(decoded.snapshot.post.quote?.text).toContain("café");
  });

  it("reads a token produced by Node zlib, including extra JSON whitespace", async () => {
    const pretty = JSON.stringify(
      {
        post: {
          text: rich.post.text,
          authorHandle: rich.post.authorHandle,
          authorName: rich.post.authorName,
        },
        version: 1,
        format: "single-post-snapshot",
        tracking: "nope",
      },
      null,
      2,
    );
    const token = zlib.deflateRawSync(Buffer.from(pretty, "utf8")).toString("base64url");
    const decoded = await decodeShareToken(token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.post.text).toContain("日本語");
    expect(canonicalJson(decoded.snapshot)).not.toContain("tracking");
  });

  it("rejects damaged, hostile, and oversized tokens", async () => {
    expect((await decodeShareToken("%%%")).ok).toBe(false);
    expect((await decodeShareToken("!!!!")).ok).toBe(false);
    const junk = zlib.deflateRawSync(Buffer.from("not json", "utf8")).toString("base64url");
    const damaged = await decodeShareToken(junk);
    expect(damaged.ok).toBe(false);

    const bomb = zlib.deflateRawSync(Buffer.alloc(LIMITS.maxBytes + 5000, 0x41)).toString("base64url");
    expect(bomb.length).toBeLessThan(LIMITS.maxShareTokenLength);
    const unpacked = await decodeShareToken(bomb);
    expect(unpacked.ok).toBe(false);
    if (!unpacked.ok) expect(unpacked.error).toContain("48 KB");

    const tooLong = "a".repeat(LIMITS.maxShareTokenLength + 1);
    const long = await decodeShareToken(tooLong);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain("too long");
  });

  it("reads the hash prefix and ignores unrelated fragments", () => {
    expect(tokenFromHash("")).toEqual({ kind: "empty" });
    expect(tokenFromHash("#s1.abc")).toEqual({ kind: "token", token: "abc" });
    expect(tokenFromHash("#https://x.com/a/status/1").kind).toBe("foreign");
  });
});

describe("producer contract", () => {
  const python = spawnSync("python3", ["--version"]);
  const hasPython = python.status === 0;

  it.runIf(hasPython)("reads a Python raw-deflate token", async () => {
    const json = canonicalJson(EXAMPLE_SNAPSHOT);
    const token = execFileSync(
      "python3",
      [
        "-c",
        [
          "import sys, zlib, base64",
          "data = sys.stdin.buffer.read()",
          "comp = zlib.compressobj(level=9, wbits=-15)",
          "raw = comp.compress(data) + comp.flush()",
          "sys.stdout.buffer.write(base64.urlsafe_b64encode(raw).rstrip(b'='))",
        ].join("\n"),
      ],
      { input: json },
    ).toString("utf8");
    const decoded = await decodeShareToken(token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.example).toBe(true);
    expect(decoded.snapshot.post.authorHandle).toBe("sample_author");
    expect(decoded.snapshot.post.text).toContain("日本語");
  });

  it("prints a reader link from the command line", async () => {
    const json = canonicalJson(rich);
    const output = execFileSync("node", ["scripts/reader-link.mjs", "http://127.0.0.1:43123"], {
      input: json,
    }).toString("utf8");
    expect(output.startsWith("http://127.0.0.1:43123/#s1.")).toBe(true);
    const token = output.trim().split("#s1.")[1];
    const decoded = await decodeShareToken(token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.post.text).toContain("café");
  });

  it("accepts the built-in example", () => {
    const parsed = parseSnapshot(canonicalJson(EXAMPLE_SNAPSHOT));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.example).toBe(true);
  });
});
