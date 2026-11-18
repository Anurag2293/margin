import zlib from "node:zlib";
import { expect, test as base, type Page } from "@playwright/test";

export const STATUS_URL = "https://x.com/ada_example/status/1234567890123456789";

export function snapshot(post: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    format: "single-post-snapshot",
    version: 1,
    ...extra,
    post: {
      authorName: "Ada M. Example",
      authorHandle: "ada_example",
      text: "Hello from Ada.\n\nSecond paragraph with https://example.com/notes and https://x.com/someone/status/1",
      createdAt: "2026-01-15T18:04:00.000Z",
      sourceUrl: STATUS_URL,
      ...post,
    },
  };
}

export function token(value: unknown): string {
  return zlib.deflateRawSync(Buffer.from(typeof value === "string" ? value : JSON.stringify(value), "utf8")).toString("base64url");
}

export function readerPath(value: unknown): string {
  return `/#s1.${token(value)}`;
}

export function isLocal(value: string): boolean {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/** Every test: external requests are aborted and recorded, page errors and console errors fail the test. */
export const test = base.extend<{ quiet: { external: string[]; errors: string[] } }>({
  quiet: [
    async ({ page }, use) => {
      const external: string[] = [];
      const errors: string[] = [];
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (!isLocal(url)) {
          external.push(url);
          await route.abort();
          return;
        }
        await route.continue();
      });
      page.on("websocket", (socket) => {
        if (!isLocal(socket.url())) external.push(socket.url());
      });
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      page.on("dialog", (dialog) => {
        errors.push(`dialog: ${dialog.message()}`);
        void dialog.dismiss();
      });
      const state = { external, errors };
      await use(state);
      expect(external, "requests left the reader").toEqual([]);
      expect(errors, "page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1000) < 640;
}
