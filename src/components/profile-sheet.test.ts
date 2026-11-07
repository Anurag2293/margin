import { describe, expect, it } from "vitest";
import { formatCount, formatJoined } from "@/components/profile-sheet";

describe("profile formatting", () => {
  it("takes the joined month from the written date, whatever the offset", () => {
    expect(formatJoined("2014-03")).toContain("2014");
    const march = formatJoined("2014-03");
    expect(formatJoined("2014-03-21")).toBe(march);
    expect(formatJoined("2014-03-01T00:30:00+09:00")).toBe(march);
    expect(formatJoined("2014-02-28T23:30:00-05:00")).not.toBe(march);
  });

  it("shortens large counts", () => {
    expect(formatCount(318)).toBe("318");
    expect(formatCount(12_400)).toBe("12.4K");
  });
});
