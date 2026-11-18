// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

let systemDark = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  localStorage.clear();
  document.documentElement.className = "";
  document.head.innerHTML = '<meta name="theme-color" content="#000">';
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  });
});

afterEach(() => {
  document.head.innerHTML = "";
});

const dark = () => document.documentElement.classList.contains("dark");

describe("ThemeToggle", () => {
  it("follows the system theme until the reader picks one", async () => {
    systemDark = true;
    render(<ThemeToggle />);
    expect(dark()).toBe(true);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#1a1715");

    systemDark = false;
    await act(async () => listeners.forEach((listener) => listener()));
    expect(dark()).toBe(false);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
  });

  it("stores the choice and stops following the system", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(dark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("margin-theme")).toBe("dark");

    systemDark = false;
    await act(async () => listeners.forEach((listener) => listener()));
    expect(dark()).toBe(true);
  });

  it("reads a stored choice and ignores junk", () => {
    localStorage.setItem("margin-theme", "dark");
    const { unmount } = render(<ThemeToggle />);
    expect(dark()).toBe(true);
    unmount();
    localStorage.setItem("margin-theme", "purple");
    systemDark = false;
    render(<ThemeToggle />);
    expect(dark()).toBe(false);
  });

  it("removes its media listener on unmount", () => {
    const { unmount } = render(<ThemeToggle />);
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("still switches the theme when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    try {
      render(<ThemeToggle />);
      expect(dark()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
      expect(errors).toEqual([]);
      expect(dark()).toBe(true);
      expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    } finally {
      window.removeEventListener("error", onError);
    }
  });
});
