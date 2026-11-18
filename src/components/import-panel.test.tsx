// @vitest-environment jsdom
import "@/test/dom";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportPanel } from "@/components/import-panel";

function panel(props: Partial<Parameters<typeof ImportPanel>[0]> = {}) {
  const handlers = {
    onDraft: vi.fn(),
    onRead: vi.fn(),
    onFile: vi.fn(),
    onExample: vi.fn(),
  };
  render(<ImportPanel draft="" error={null} busy={false} {...handlers} {...props} />);
  return { ...handlers, box: screen.getByLabelText("Snapshot JSON") as HTMLTextAreaElement };
}

function paste(target: Element, text: string) {
  const event = createEvent.paste(target, { clipboardData: { getData: () => text } });
  fireEvent(target, event);
  return event;
}

describe("ImportPanel", () => {
  it("reads a paste into the empty box at once", () => {
    const { box, onDraft, onRead } = panel();
    const event = paste(box, '{"a":1}');
    expect(event.defaultPrevented).toBe(true);
    expect(onDraft).toHaveBeenCalledWith('{"a":1}');
    expect(onRead).toHaveBeenCalledWith('{"a":1}');
  });

  it("lets a paste into a box with text, or a blank paste, edit normally", () => {
    const filled = panel({ draft: "{" });
    expect(paste(filled.box, "more").defaultPrevented).toBe(false);
    expect(filled.onRead).not.toHaveBeenCalled();
  });

  it("ignores a blank paste", () => {
    const { box, onRead } = panel();
    expect(paste(box, "  \n").defaultPrevented).toBe(false);
    expect(onRead).not.toHaveBeenCalled();
  });

  it("reads on Ctrl+Enter or Cmd+Enter, but not on Enter alone", () => {
    const { box, onRead } = panel({ draft: "{}" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onRead).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    expect(onRead).toHaveBeenCalledTimes(2);
  });

  it("forwards typing, the read button, and the example button", () => {
    const { box, onDraft, onRead, onExample } = panel();
    fireEvent.change(box, { target: { value: "x" } });
    expect(onDraft).toHaveBeenCalledWith("x");
    fireEvent.click(screen.getByRole("button", { name: /Read snapshot/ }));
    expect(onRead).toHaveBeenCalledWith();
    fireEvent.click(screen.getByRole("button", { name: "Try the example" }));
    expect(onExample).toHaveBeenCalled();
  });

  it("passes a chosen file on and clears the input so the same file can be chosen again", () => {
    const { onFile } = panel();
    const input = screen.getByLabelText("Upload JSON file") as HTMLInputElement;
    const file = new File(["{}"], "post.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  it("takes a dropped file and ignores a drop without files", () => {
    const { onFile } = panel();
    const zone = screen.getByLabelText("Snapshot JSON").parentElement!;
    const file = new File(["{}"], "post.json", { type: "application/json" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(onFile).toHaveBeenCalledWith(file);
    fireEvent.drop(zone, { dataTransfer: { files: [], types: ["text/plain"] } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("shows the error as an alert tied to the box, or the hint otherwise", () => {
    const { box } = panel({ error: "This is not valid JSON." });
    expect(screen.getByRole("alert").textContent).toBe("This is not valid JSON.");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe("snapshot-error");
  });

  it("disables every action while busy", () => {
    panel({ busy: true });
    for (const name of ["Upload JSON", "Try the example", /Read snapshot/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("focuses the box when asked", () => {
    const { box } = panel({ autoFocus: true });
    expect(document.activeElement).toBe(box);
  });
});
