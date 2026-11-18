// @vitest-environment jsdom
import "@/test/dom";
import { render } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/avatar";

function initials(name: string, handle = "h"): string {
  const { container, unmount } = render(<Avatar name={name} handle={handle} />);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

describe("Avatar", () => {
  it("uses the embedded image when there is one, hidden from screen readers", () => {
    const { container } = render(<Avatar name="Ada" handle="ada" src="data:image/png;base64,AAAA" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["Ada Lovelace", "AL"],
    ["ada", "A"],
    ["Ada M. Example", "AE"],
    ["  ada   lovelace  ", "AL"],
    ["日本 太郎", "日太"],
    ["🌳 Tree", "T"],
    ["👩🏽‍💻", "?"],
    ["!!!", "?"],
    ["élodie durand", "ÉD"],
    ["𝒜da 𝒷", "𝒜𝒷"],
  ])("takes initials of %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it("picks the same color for a handle in any case", () => {
    const style = (handle: string) => {
      const { container, unmount } = render(<Avatar name="A" handle={handle} />);
      const value = (container.firstElementChild as HTMLElement).style.getPropertyValue("--hue");
      unmount();
      return value;
    };
    expect(style("Ada_Example")).toBe(style("ada_example"));
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9_]{1,15}$/), (handle) => {
        expect(["32", "55", "85", "140", "175", "200", "300", "345"]).toContain(style(handle));
      }),
      { numRuns: 50 },
    );
  });

  it("never renders more than two initials for letters that keep their length in upper case", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 50 }).filter((name) => name.toUpperCase().length === name.length), (name) => {
        expect(Array.from(initials(name)).length).toBeLessThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});
