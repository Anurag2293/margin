// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PostText } from "@/components/post-text";
import { hostileText } from "@/test/arbitraries";

function visibleText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((node) => node.remove());
  return clone.textContent ?? "";
}

describe("PostText", () => {
  it("says so when there is no text", () => {
    render(<PostText text="" testId="t" />);
    expect(screen.getByTestId("t").textContent).toBe("No text was included in this snapshot.");
  });

  it("renders markup as text and opens only safe links in a new tab without a referrer", () => {
    const text = "<img src=x onerror=alert(1)> https://example.com/a and https://x.com/a/status/1 javascript:alert(1)";
    render(<PostText text={text} testId="t" />);
    const root = screen.getByTestId("t");
    expect(root.querySelector("img")).toBeNull();
    expect(visibleText(root)).toBe(text);
    const links = root.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://example.com/a");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(links[0].getAttribute("referrerpolicy")).toBe("no-referrer");
    const blocked = root.querySelector(".blocked-url");
    expect(blocked?.textContent).toContain("https://x.com/a/status/1");
    expect(blocked?.textContent).toContain("(not linked)");
  });

  it("shows any text exactly, with only https links as anchors", () => {
    fc.assert(
      fc.property(hostileText(16).filter((text) => text.length > 0), (text) => {
        const { container, unmount } = render(<PostText text={text} testId="t" />);
        try {
          const root = container.firstElementChild as HTMLElement;
          expect(visibleText(root)).toBe(text);
          expect(root.querySelectorAll("img, script, iframe, object, embed, svg")).toHaveLength(0);
          for (const anchor of root.querySelectorAll("a")) {
            const href = new URL(anchor.getAttribute("href") ?? "");
            expect(href.protocol).toBe("https:");
            expect(href.hostname).not.toMatch(/(^|\.)(x\.com|twitter\.com|twimg\.com|t\.co)$/i);
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 150 },
    );
  });
});
