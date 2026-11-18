import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { LIMITS } from "@/lib/limits";
import { decodeShareToken } from "@/lib/share";
import { canonicalJson, toCanonical } from "@/lib/snapshot";

const SCRIPT = path.join(__dirname, "reader-link.mjs");

function run(input: string | Buffer, args: string[] = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { input });
  return { status: result.status, stdout: result.stdout.toString("utf8"), stderr: result.stderr.toString("utf8") };
}

async function decodeLink(link: string) {
  return decodeShareToken(link.trim().split("#s1.")[1]);
}

describe("scripts/reader-link.mjs", () => {
  it("prints a link for the default origin that opens the same snapshot", async () => {
    const out = run(canonicalJson(EXAMPLE_SNAPSHOT));
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/^http:\/\/127\.0\.0\.1:43123\/#s1\.[A-Za-z0-9_-]+\n$/);
    expect(await decodeLink(out.stdout)).toEqual({ ok: true, snapshot: toCanonical(EXAMPLE_SNAPSHOT) });
  });

  it("drops one trailing slash from the origin", () => {
    expect(run("{}", ["https://margin.example/"]).stdout).toMatch(/^https:\/\/margin\.example\/#s1\./);
    expect(run("{}", ["https://margin.example/reader"]).stdout).toMatch(/^https:\/\/margin\.example\/reader\/#s1\./);
  });

  it("rejects invalid JSON with exit code 1", () => {
    const out = run("{not json");
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("not valid JSON");
    expect(out.stdout).toBe("");
  });

  it("rejects input over 48 KB with exit code 1 and accepts exactly 48 KB", () => {
    const body = (size: number) => `{"a":"${"x".repeat(size - 8)}"}`;
    expect(Buffer.byteLength(body(LIMITS.maxBytes))).toBe(LIMITS.maxBytes);
    expect(run(body(LIMITS.maxBytes)).status).toBe(0);
    const over = run(body(LIMITS.maxBytes + 1));
    expect(over.status).toBe(1);
    expect(over.stderr).toContain("larger than 48 KB");
  });

  it("refuses a link longer than 24,000 characters with exit code 2", () => {
    let seed = 7;
    const text = Array.from({ length: 11_000 }, () => {
      seed = (seed * 48271) % 2147483647;
      return String.fromCodePoint(0x4e00 + (seed % 20_000));
    }).join("");
    const out = run(JSON.stringify({ text }));
    expect(out.status).toBe(2);
    expect(out.stderr).toContain("24000");
    expect(out.stdout).toBe("");
  });
});
