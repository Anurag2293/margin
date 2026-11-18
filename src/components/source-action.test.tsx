// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceAction } from "@/components/source-action";

const URL_X = "https://x.com/ada/status/1";

describe("SourceAction", () => {
  it("does not render a link to X until the warning is open", async () => {
    render(<SourceAction url={URL_X} label="Source on X" className="" short="Source" />);
    expect(document.querySelector("a")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Source on X" }));
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("This opens X");
    expect(dialog.textContent).toContain(URL_X);
    const link = screen.getByRole("link", { name: "Open anyway" });
    expect(link.getAttribute("href")).toBe(URL_X);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(document.activeElement?.textContent).toBe("Stay here");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    });
    expect(screen.queryByRole("link", { name: "Open anyway" })).toBeNull();
  });

  it("uses the full label as the button text when there is no short label", () => {
    render(<SourceAction url={URL_X} label="Quoted source on X" className="" />);
    expect(screen.getByRole("button", { name: "Quoted source on X" }).textContent).toBe("Quoted source on X");
  });
});
