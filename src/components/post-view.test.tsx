// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PostView } from "@/components/post-view";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { parseSnapshot, type Snapshot } from "@/lib/snapshot";

const SHARE = "https://margin.test/#s1.abc";

function view(snapshot: Snapshot, props: Partial<{ shareUrl: string | null; shareNote: string | null; onClear: () => void }> = {}) {
  const headingRef = createRef<HTMLHeadingElement>();
  const onClear = props.onClear ?? vi.fn();
  render(
    <PostView
      snapshot={snapshot}
      shareUrl={props.shareUrl === undefined ? SHARE : props.shareUrl}
      shareNote={props.shareNote ?? null}
      headingRef={headingRef}
      onClear={onClear}
    />,
  );
  return { headingRef, onClear };
}

function post(overrides: Partial<Snapshot["post"]> = {}, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    format: "single-post-snapshot",
    version: 1,
    ...extra,
    post: { authorName: "Ada M. Example", authorHandle: "ada_example", text: "Hello", ...overrides },
  };
}

function captureDownload() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  const create = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:margin-test";
  });
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  return { blobs, names, revoke };
}

describe("PostView", () => {
  it("shows the author, handle, missing time, and the heading ref", () => {
    const { headingRef } = view(post());
    expect(screen.getByRole("heading", { level: 2, name: "Ada M. Example" })).toBe(headingRef.current);
    expect(screen.getByText("@ada_example")).toBeTruthy();
    expect(screen.getByText("Time not included")).toBeTruthy();
    expect(screen.queryByTestId("example-banner")).toBeNull();
  });

  it("marks the example, keeps its language, and lists media as descriptions only", () => {
    view(EXAMPLE_SNAPSHOT);
    expect(screen.getByTestId("example-banner").textContent).toContain("Not a real post");
    expect(screen.getByRole("article").getAttribute("lang")).toBe("en");
    const media = screen.getAllByTestId("media-note");
    expect(media).toHaveLength(1);
    expect(media[0].textContent).toContain("Photo unavailable");
    expect(media[0].textContent).toContain("Warm light on a wooden table");
    expect(document.querySelectorAll("article img, article video, article audio, article iframe")).toHaveLength(0);
    const quote = screen.getByRole("region", { name: "Quoted post" });
    expect(within(quote).getByRole("heading", { name: "Quoted Example" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Verified" })).toBeTruthy();
  });

  it("renders a time element with the original value", () => {
    view(post({ createdAt: "2026-04-02T16:30:00.000Z" }));
    const time = document.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-04-02T16:30:00.000Z");
    expect(time?.textContent).toMatch(/2026/);
  });

  it("names every media kind", () => {
    view(post({ text: "", media: [{ kind: "photo" }, { kind: "video" }, { kind: "gif" }, { kind: "audio", alt: "Rain" }] }));
    const labels = screen.getAllByTestId("media-note").map((item) => item.textContent);
    expect(labels[0]).toContain("Photo unavailable");
    expect(labels[1]).toContain("Video unavailable");
    expect(labels[2]).toContain("Animation unavailable");
    expect(labels[3]).toContain("Audio unavailable");
    expect(labels[3]).toContain("Rain");
    expect(screen.getByTestId("post-text").textContent).toBe("No text was included in this snapshot.");
  });

  it("copies the reader link and resets the label after two seconds", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    view(post());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(writeText).toHaveBeenCalledWith(SHARE);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("shows the link in a field to copy by hand when the clipboard is blocked", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    view(post());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    const field = screen.getByTestId("reader-link") as HTMLInputElement;
    expect(field.value).toBe(SHARE);
    expect(field.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("hides Copy link without a reader link and shows why", () => {
    view(post(), { shareUrl: null, shareNote: "This snapshot is too large for a reader link." });
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("too large");
  });

  it("closes through onClear", () => {
    const { onClear } = view(post());
    fireEvent.click(screen.getByRole("button", { name: "Close post" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("offers Source on X only when there is a source", () => {
    view(post());
    expect(screen.queryByRole("button", { name: "Source on X" })).toBeNull();
  });

  it("downloads the canonical snapshot as margin-<handle>.json", async () => {
    const { blobs, names, revoke } = captureDownload();
    view(post({ text: "Line\n<b>bold</b>" }, { example: true }));
    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(names).toEqual(["margin-ada_example.json"]);
    expect(blobs[0].type).toBe("application/json");
    const parsed = parseSnapshot(await blobs[0].text());
    expect(parsed).toEqual({ ok: true, snapshot: post({ text: "Line\n<b>bold</b>" }, { example: true }) });
    expect(revoke).toHaveBeenCalledWith("blob:margin-test");
  });

});
