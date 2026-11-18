import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LIMITS, formatBytes } from "@/lib/limits";

describe("formatBytes", () => {
  it("reads bytes, small KB, and large KB", () => {
    expect(formatBytes(0)).toBe("0 bytes");
    expect(formatBytes(1023)).toBe("1023 bytes");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024)).toBe("10 KB");
    expect(formatBytes(LIMITS.maxBytes)).toBe("48 KB");
  });

  it("always ends in a unit and never prints NaN", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1e9 }), (bytes) => {
        const label = formatBytes(bytes);
        expect(label).toMatch(/^\d+(\.\d)? (bytes|KB)$/);
      }),
    );
  });
});

describe("limits", () => {
  it("keep the documented numbers", () => {
    expect(LIMITS.maxBytes).toBe(49_152);
    expect(LIMITS.maxText).toBe(12_000);
    expect(LIMITS.maxShareTokenLength).toBe(24_000);
    expect(LIMITS.maxAvatar).toBe(20_000);
  });
});
