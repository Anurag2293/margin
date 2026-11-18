import fs from "node:fs";
import { STATUS_URL, expect, isPhone, noHorizontalOverflow, readerPath, snapshot, test, token } from "./support";

const author = (page: import("@playwright/test").Page, name = "Ada M. Example") =>
  page.getByRole("heading", { level: 2, name });

test.describe("reading", () => {
  test("opens the example, its profile, and closes back to the empty page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try the example" }).click();
    await expect(author(page, "Sample Author")).toBeVisible();
    await expect(page.getByTestId("example-banner")).toBeVisible();
    await expect(page).toHaveTitle("Example — Margin");
    await expect(author(page, "Sample Author")).toBeFocused();
    expect(page.url()).toContain("#s1.");
    await noHorizontalOverflow(page);

    await page.getByRole("button", { name: /View profile of Sample Author/ }).click();
    const sheet = page.getByTestId("profile-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Joined March 2014");
    const box = (await sheet.boundingBox())!;
    const viewport = page.viewportSize()!;
    if (isPhone(page)) {
      await expect.poll(async () => Math.round((await sheet.boundingBox())!.y + (await sheet.boundingBox())!.height)).toBe(viewport.height);
      expect(Math.round(box.width)).toBe(viewport.width);
    } else {
      expect(box.width).toBeLessThanOrEqual(448);
      await page.getByRole("button", { name: "Close profile" }).click();
      await expect(sheet).toBeHidden();
      await page.getByRole("button", { name: /View profile of Sample Author/ }).click();
      await expect(sheet).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Close post" }).click();
    await expect(page.getByRole("heading", { name: "Read one post, and nothing else." })).toBeVisible();
    await expect(page).toHaveTitle("Margin");
    expect(new URL(page.url()).hash).toBe("");
  });

  test("keeps very long words, links, names, and alt text inside the page", async ({ page }) => {
    const word = "W".repeat(3_000);
    await page.goto(
      readerPath(
        snapshot({
          authorName: "N".repeat(50),
          authorHandle: "a".repeat(15),
          text: `${word}\nhttps://example.com/${"p".repeat(1_500)}\n${"日本語".repeat(500)}`,
          media: [{ kind: "photo", alt: "A".repeat(1_000) }],
          quote: { authorName: "Q".repeat(50), authorHandle: "q".repeat(15), text: word, sourceUrl: STATUS_URL },
          profile: { bio: word.slice(0, 500), location: "L".repeat(100), website: `https://example.com/${"w".repeat(270)}` },
        }),
      ),
    );
    await expect(page.getByTestId("post-text")).toContainText("WWWW");
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: /View profile of N+/ }).click();
    await expect(page.getByTestId("profile-sheet")).toBeVisible();
    await noHorizontalOverflow(page);
    const sheet = (await page.getByTestId("profile-sheet").boundingBox())!;
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test("renders hostile text as text, links only safe https addresses, and runs no script", async ({ page }) => {
    await page.goto(
      readerPath(
        snapshot({
          authorName: "<img src=x onerror=window.__pwned=1>",
          text: [
            "<script>window.__pwned=1</script>",
            "<img src=x onerror=window.__pwned=1>",
            "javascript:window.__pwned=1",
            "[see (https://example.com/a)]",
            "https://user:pw@example.com/ https://example.com:8443/ https://exa。mple.com/",
            "‮reversed‬",
          ].join("\n"),
          lang: "ar",
        }),
      ),
    );
    await expect(page.getByTestId("post-text")).toContainText("<script>window.__pwned=1</script>");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("<img src=x onerror=window.__pwned=1>");
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    const hrefs = await page.locator("article a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    expect(hrefs).toEqual(["https://example.com/a"]);
    await expect(page.locator("article")).toHaveAttribute("lang", "ar");
  });

  test("follows back and forward between two reader links", async ({ page }) => {
    await page.goto(readerPath(snapshot({ text: "First post" })));
    await expect(page.getByTestId("post-text")).toHaveText("First post");
    await page.goto(readerPath(snapshot({ text: "Second post" })));
    await expect(page.getByTestId("post-text")).toHaveText("Second post");
    await page.goBack();
    await expect(page.getByTestId("post-text")).toHaveText("First post");
    await page.goForward();
    await expect(page.getByTestId("post-text")).toHaveText("Second post");
  });

  test("keeps the post when the skip link is used from the keyboard", async ({ page }) => {
    test.skip(isPhone(page), "keyboard navigation");
    await page.goto(readerPath(snapshot({ text: "Stay with me" })));
    await expect(author(page)).toBeFocused();
    const link = page.url();
    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect(page.getByTestId("post-text")).toHaveText("Stay with me");
    await expect(page.locator("#snapshot-error")).toHaveCount(0);
    expect(page.url()).toBe(link);
  });
});

test.describe("adding a snapshot", () => {
  test("reads a paste into the empty box at once", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await page.evaluate((text) => navigator.clipboard.writeText(text), JSON.stringify(snapshot({ text: "Pasted text" })));
    await page.getByLabel("Snapshot JSON").focus();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(page.getByTestId("post-text")).toHaveText("Pasted text");
  });

  test("reads with Ctrl+Enter and explains empty, invalid, and address-only input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Read snapshot/ }).click();
    await expect(page.locator("#snapshot-error")).toHaveText("Paste a snapshot first.");
    await page.getByLabel("Snapshot JSON").fill('{"format":"single-post-snapshot","version":"1"}');
    await page.getByLabel("Snapshot JSON").press("Control+Enter");
    await expect(page.locator("#snapshot-error")).toHaveText("version must be 1.");
    await page.getByLabel("Snapshot JSON").fill("https://example.com/a-post");
    await page.getByLabel("Snapshot JSON").press("Control+Enter");
    await expect(page.getByRole("region", { name: "A link is not the post" })).toContainText("does not fetch web addresses");
    await page.getByLabel("Snapshot JSON").fill(JSON.stringify(snapshot({ text: "Typed" })));
    await page.getByLabel("Snapshot JSON").press("Control+Enter");
    await expect(page.getByTestId("post-text")).toHaveText("Typed");
  });

  test("opens an uploaded file saved with a BOM and a dropped file", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Upload JSON file").setInputFiles({
      name: "post.json",
      mimeType: "application/json",
      buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(snapshot({ text: "From a file" })))]),
    });
    await expect(page.getByTestId("post-text")).toHaveText("From a file");

    await page.getByRole("button", { name: "New" }).click();
    const drop = await page.evaluateHandle((text) => {
      const data = new DataTransfer();
      data.items.add(new File([text], "dropped.json", { type: "application/json" }));
      return data;
    }, JSON.stringify(snapshot({ text: "Dropped" })));
    const zone = page.getByLabel("Snapshot JSON").locator("..");
    await zone.dispatchEvent("dragover", { dataTransfer: drop });
    await zone.dispatchEvent("drop", { dataTransfer: drop });
    await expect(page.getByTestId("post-text")).toHaveText("Dropped");
  });

  test("downloads a file it can open again, even at the size limit", async ({ page }) => {
    const big = snapshot({
      text: "日".repeat(12_000),
      createdAt: undefined,
      sourceUrl: undefined,
      media: Array.from({ length: 4 }, () => ({ kind: "photo", alt: "a".repeat(1_000) })),
      quote: { authorName: "Q", authorHandle: "q", text: "" },
    });
    const used = Buffer.byteLength(JSON.stringify(big));
    (big.post as unknown as { quote: { text: string } }).quote.text = "b".repeat(48 * 1024 - used);
    expect(Buffer.byteLength(JSON.stringify(big))).toBe(48 * 1024);

    await page.goto("/");
    await page.getByLabel("Upload JSON file").setInputFiles({ name: "big.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(big)) });
    await expect(author(page)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download JSON" }).click()]);
    expect(download.suggestedFilename()).toBe("margin-ada_example.json");
    const file = fs.readFileSync(await download.path());
    expect(file.byteLength).toBeLessThanOrEqual(48 * 1024);

    await page.getByRole("button", { name: "Close post" }).click();
    await page.getByLabel("Upload JSON file").setInputFiles({ name: "again.json", mimeType: "application/json", buffer: file });
    await expect(author(page)).toBeVisible();
    await expect(page.locator("#snapshot-error")).toHaveCount(0);
  });
});

test.describe("sharing", () => {
  test("copies a link that opens the same post in a new tab", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(readerPath(snapshot({ text: "Share me", tracking: "drop" })));
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible({ timeout: 4_000 });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());

    const other = await context.newPage();
    await other.route("**/*", (route) => (new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort()));
    await other.goto(copied);
    await expect(other.getByTestId("post-text")).toHaveText("Share me");
    await other.close();
  });

  test("offers the link in a field when the clipboard is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) },
      });
    });
    await page.goto(readerPath(snapshot()));
    await page.getByRole("button", { name: "Copy link" }).click();
    const field = page.getByTestId("reader-link");
    await expect(field).toHaveValue(page.url());
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe(page.url().length);
  });

  test("asks before opening the source on X and stays on Margin", async ({ page, context }) => {
    await page.goto(readerPath(snapshot()));
    await page.getByRole("button", { name: "Source on X" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("This opens X");
    await expect(dialog.getByRole("link", { name: "Open anyway" })).toHaveAttribute("href", STATUS_URL);
    await expect(dialog.getByRole("button", { name: "Stay here" })).toBeFocused();
    await dialog.getByRole("button", { name: "Stay here" }).click();
    await expect(dialog).toBeHidden();
    expect(context.pages()).toHaveLength(1);
    await expect(page.locator("a[href*='x.com']")).toHaveCount(0);
  });
});

test.describe("empty and error states", () => {
  for (const [name, hash, message] of [
    ["damaged token", "#s1.AAAA", /damaged|not valid JSON/],
    ["foreign characters", "#s1.abc%2B%2F", /characters Margin does not use/],
    ["unrelated fragment", "#somewhere", /not a Margin snapshot/],
    ["invalid snapshot", `#s1.${token({ format: "single-post-snapshot", version: 2, post: {} })}`, /version must be 1/],
    ["unpacks too large", `#s1.${token(Buffer.alloc(1024 * 1024, 0x20).toString())}`, /more than 48 KB/],
  ] as const) {
    test(`explains a ${name} link and keeps the import box`, async ({ page }) => {
      await page.goto(`/${hash}`);
      await expect(page.locator("#snapshot-error")).toHaveText(message);
      await expect(page.getByLabel("Snapshot JSON")).toBeVisible();
      await expect(page.locator("article")).toHaveCount(0);
      await noHorizontalOverflow(page);
    });
  }

  test("explains an X address in the fragment", async ({ page }) => {
    await page.goto("/#https://x.com/someone/status/42");
    await expect(page.getByRole("region", { name: "A link is not the post" })).toContainText("never contacts X");
    await expect(page.locator("article")).toHaveCount(0);
  });

  test("snapshot shape details show the invented example", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Snapshot shape").click();
    await expect(page.locator("details pre")).toContainText('"format": "single-post-snapshot"');
    await noHorizontalOverflow(page);
  });
});

test.describe("network", () => {
  test("keeps working offline once loaded", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Try the example" })).toBeEnabled();
    await context.setOffline(true);
    try {
      await page.getByRole("button", { name: "Try the example" }).click();
      await expect(author(page, "Sample Author")).toBeVisible();
      await page.getByRole("button", { name: "New" }).click();
      await page.getByLabel("Snapshot JSON").fill(JSON.stringify(snapshot({ text: "Offline paste" })));
      await page.getByRole("button", { name: /Read snapshot/ }).click();
      await expect(page.getByTestId("post-text")).toHaveText("Offline paste");
      await page.evaluate((hash) => {
        location.hash = hash;
      }, readerPath(snapshot({ text: "Offline link" })).slice(1));
      await expect(page.getByTestId("post-text")).toHaveText("Offline link");
    } finally {
      await context.setOffline(false);
    }
  });

  test("opens a reader link after slow script loading", async ({ page }) => {
    await page.route("**/_next/static/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.goto(readerPath(snapshot({ text: "Slow but sure" })));
    await expect(page.getByTestId("post-text")).toHaveText("Slow but sure", { timeout: 20_000 });
  });

  test("does not stay busy when a slow read is replaced", async ({ page }) => {
    await page.addInitScript(() => {
      const Original = window.CompressionStream;
      window.CompressionStream = class extends Original {
        constructor(format: CompressionFormat) {
          super(format);
          const delay = new TransformStream({
            async transform(chunk, controller) {
              await new Promise((resolve) => setTimeout(resolve, 600));
              controller.enqueue(chunk);
            },
          });
          return { readable: super.readable.pipeThrough(delay), writable: super.writable } as unknown as CompressionStream;
        }
      } as typeof CompressionStream;
    });
    await page.goto("/");
    await page.getByLabel("Snapshot JSON").fill(JSON.stringify(snapshot({ text: "Slow" })));
    await page.getByRole("button", { name: /Read snapshot/ }).click();
    await expect(page.getByRole("button", { name: "Try the example" })).toBeDisabled();
    await page.getByRole("button", { name: "Margin" }).click();
    await expect(page.getByRole("button", { name: "Try the example" })).toBeEnabled({ timeout: 5_000 });
    await expect(page.locator("article")).toHaveCount(0);
  });
});

test.describe("theme", () => {
  test("remembers the chosen theme across reloads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  test("switches the theme when site storage is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
