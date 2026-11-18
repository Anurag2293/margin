// @vitest-environment jsdom
import "@/test/dom";
import { Blob as NodeBlob } from "node:buffer";
import zlib from "node:zlib";
import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Reader } from "@/components/reader";
import { LIMITS } from "@/lib/limits";

function json(post: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: "single-post-snapshot",
    version: 1,
    ...extra,
    post: { authorName: "Ada M. Example", authorHandle: "ada_example", text: "Hello from Ada", ...post },
  });
}

function token(text: string): string {
  return zlib.deflateRawSync(Buffer.from(text, "utf8")).toString("base64url");
}

function box() {
  return screen.getByLabelText("Snapshot JSON") as HTMLTextAreaElement;
}

function paste(text: string) {
  const target = box();
  fireEvent(target, createEvent.paste(target, { clipboardData: { getData: () => text } }));
}

async function setHash(hash: string) {
  await act(async () => {
    history.replaceState(null, "", `/${hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

const author = (name = "Ada M. Example") => screen.findByRole("heading", { level: 2, name });

beforeEach(() => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  history.replaceState(null, "", "/");
  document.title = "Margin";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
});

describe("Reader", () => {
  it("starts empty with the intro and the import box", () => {
    render(<Reader />);
    expect(screen.getByRole("heading", { name: "Read one post, and nothing else." })).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("region", { name: "How Margin works" })).toBeTruthy();
  });

  it("opens the example, names the tab, and closes back to empty", async () => {
    render(<Reader />);
    fireEvent.click(screen.getByRole("button", { name: "Try the example" }));
    expect(await author("Sample Author")).toBeTruthy();
    expect(location.hash).toMatch(/^#s1\.[A-Za-z0-9_-]+$/);
    expect(document.title).toBe("Example — Margin");
    expect(document.activeElement?.id).toBe("post-author");

    fireEvent.click(screen.getByRole("button", { name: "Close post" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(location.hash).toBe("");
    expect(document.title).toBe("Margin");
  });

  it("toggles the import box over an open post", async () => {
    render(<Reader />);
    fireEvent.click(screen.getByRole("button", { name: "Try the example" }));
    await author("Sample Author");
    expect(screen.queryByLabelText("Snapshot JSON")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(document.activeElement).toBe(box());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Snapshot JSON")).toBeNull();
  });

  it("opens a reader link from the address on load and rewrites it to the canonical token", async () => {
    const input = json({ text: "From the hash", tracking: "x" });
    history.replaceState(null, "", `/#s1.${token(input)}`);
    render(<Reader />);
    expect(await author()).toBeTruthy();
    expect(screen.getByTestId("post-text").textContent).toBe("From the hash");
    expect(document.title).toBe("Ada M. Example — Margin");
    const rewritten = location.hash.slice(4);
    expect(zlib.inflateRawSync(Buffer.from(rewritten, "base64url")).toString()).not.toContain("tracking");
  });

  it("follows hash changes to another post", async () => {
    render(<Reader />);
    await setHash(`#s1.${token(json({ text: "First" }))}`);
    await waitFor(() => expect(screen.getByTestId("post-text").textContent).toBe("First"));
    await setHash(`#s1.${token(json({ text: "Second" }))}`);
    await waitFor(() => expect(screen.getByTestId("post-text").textContent).toBe("Second"));
    await setHash("");
    await waitFor(() => expect(screen.queryByRole("article")).toBeNull());
  });

  it("explains an X address in the fragment instead of inventing a post", async () => {
    history.replaceState(null, "", "/#https://x.com/someone/status/42");
    render(<Reader />);
    expect(await screen.findByRole("heading", { name: "A link is not the post" })).toBeTruthy();
    expect(screen.getByText("https://x.com/someone/status/42")).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("shows why a damaged reader link cannot be opened", async () => {
    history.replaceState(null, "", "/#s1.AAAA");
    render(<Reader />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/damaged|not valid JSON|did not contain/);
    expect(box()).toBeTruthy();
  });

  it("opens pasted JSON, explains a pasted address, and reports invalid JSON", async () => {
    render(<Reader />);
    paste("https://x.com/someone/status/42");
    expect(await screen.findByRole("heading", { name: "A link is not the post" })).toBeTruthy();

    fireEvent.change(box(), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: /Read snapshot/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("not valid JSON");

    fireEvent.change(box(), { target: { value: "" } });
    paste(json({ text: "Pasted" }));
    expect(await author()).toBeTruthy();
    expect(screen.getByTestId("post-text").textContent).toBe("Pasted");
  });

  it("opens a reader link pasted with other words around it", async () => {
    render(<Reader />);
    paste(`look: https://margin.example/#s1.${token(json({ text: "Linked" }))} thanks`);
    expect(await author()).toBeTruthy();
    expect(screen.getByTestId("post-text").textContent).toBe("Linked");
  });

  it("refuses a file over 48 KB before reading it", async () => {
    render(<Reader />);
    const big = new File(["a".repeat(LIMITS.maxBytes + 1)], "big.json", { type: "application/json" });
    const text = vi.spyOn(big, "text");
    fireEvent.change(screen.getByLabelText("Upload JSON file"), { target: { files: [big] } });
    expect((await screen.findByRole("alert")).textContent).toContain("larger than 48 KB");
    expect(text).not.toHaveBeenCalled();
  });

  it("opens an uploaded file", async () => {
    render(<Reader />);
    const file = new File([json({ text: "From a file" })], "post.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Upload JSON file"), { target: { files: [file] } });
    expect(await author()).toBeTruthy();
    expect(screen.getByTestId("post-text").textContent).toBe("From a file");
  });

  it("explains when a post is too large for a reader link and leaves no stale hash", async () => {
    let seed = 11;
    const text = Array.from({ length: 11_000 }, () => {
      seed = (seed * 48271) % 2147483647;
      return String.fromCodePoint(0x4e00 + (seed % 20_000));
    }).join("");
    render(<Reader />);
    paste(json({ text }));
    expect(await author()).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("too large for a reader link");
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
    expect(location.hash).toBe("");
  });

  it("shows only the latest of two overlapping reads", async () => {
    render(<Reader />);
    paste(json({ text: "Older" }));
    await setHash(`#s1.${token(json({ text: "Newer" }))}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByTestId("post-text").textContent).toBe("Newer");
  });

});
