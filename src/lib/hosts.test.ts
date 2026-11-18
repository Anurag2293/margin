import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isBlockedHost } from "@/lib/hosts";

const ROOTS = ["x.com", "twitter.com", "twimg.com", "t.co"];
const label = fc.stringMatching(/^[a-z0-9](?:[a-z0-9-]{0,10}[a-z0-9])?$/);

describe("isBlockedHost", () => {
  it("blocks the roots and their subdomains, in any case, with a trailing dot or brackets", () => {
    for (const host of [
      "x.com",
      "X.COM",
      "x.com.",
      " www.x.com ",
      "mobile.twitter.com",
      "pbs.twimg.com",
      "video.twimg.com",
      "t.co",
      "T.Co.",
      "[x.com]",
    ]) {
      expect(isBlockedHost(host), host).toBe(true);
    }
  });

  it("does not block lookalikes or empty input", () => {
    for (const host of ["", " ", "notx.com", "x.com.evil.example", "xcom", "twitter.co", "t.com", "tco", "example.com"]) {
      expect(isBlockedHost(host), host).toBe(false);
    }
  });

  it("blocks every subdomain of a root", () => {
    fc.assert(
      fc.property(fc.array(label, { minLength: 1, maxLength: 4 }), fc.constantFrom(...ROOTS), (labels, root) => {
        expect(isBlockedHost(`${labels.join(".")}.${root}`)).toBe(true);
      }),
    );
  });

  it("does not block a host that only contains a root as a prefix or infix", () => {
    fc.assert(
      fc.property(label, fc.constantFrom(...ROOTS), fc.constantFrom("example", "evil.test"), (prefix, root, tld) => {
        const host = `${root}.${prefix}.${tld}`;
        expect(isBlockedHost(host)).toBe(false);
        expect(isBlockedHost(`${prefix}${root}`)).toBe(false);
      }),
    );
  });
});
