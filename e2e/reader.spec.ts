import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import zlib from "node:zlib";

const STATUS_URL = "https://x.com/ada_example/status/1234567890123456789";

function hostileSnapshot() {
  const longLink = `https://example.com/${"a".repeat(160)}`;
  return {
    format: "single-post-snapshot",
    version: 1,
    tracking: "must-not-survive",
    post: {
      authorName: "Ada M. Example",
      authorHandle: "ada_example",
      lang: "en",
      createdAt: "2026-01-15T18:04:00.000Z",
      sourceUrl: `${STATUS_URL}?s=20`,
      text: [
        "Line one with emoji 🌱 and 日本語.",
        "Second paragraph — em dash, quotes “like this”, and café.",
        `Safe link https://example.com/field-notes?q=1.`,
        `Long link ${longLink}`,
        "Blocked https://x.com/someone/status/1 and https://t.co/abcXYZ and https://pbs.twimg.com/media/abc.jpg",
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
      ].join("\n\n"),
      quote: {
        authorName: "Quoted Poet",
        authorHandle: "poet_example",
        createdAt: "2026-01-14T08:00:00.000Z",
        text: "A quoted line\nwith a second line · café",
        sourceUrl: "https://twitter.com/poet_example/status/55/photo/1",
        media: [{ kind: "gif", alt: "A short loop of rain on a window" }],
      },
      media: [
        { kind: "photo", alt: "Window light on a wooden desk" },
        { kind: "video", alt: "Short clip of rain" },
      ],
    },
  };
}

function readerPath(snapshot: unknown): string {
  const token = zlib.deflateRawSync(Buffer.from(JSON.stringify(snapshot), "utf8")).toString("base64url");
  return `/#s1.${token}`;
}

function guard(page: Page) {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!isLocal(url)) unexpected.push(url);
  });
  page.on("websocket", (socket) => {
    if (!isLocal(socket.url())) unexpected.push(socket.url());
  });
  page.on("dialog", () => {
    throw new Error("Unexpected browser dialog");
  });
  return {
    assertQuiet() {
      expect(unexpected, `requests left the reader:\n${unexpected.join("\n")}`).toEqual([]);
    },
  };
}

function isLocal(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (!isLocal(route.request().url())) {
      await route.abort();
      return;
    }
    await route.continue();
  });
});

test("starts empty, with no invented post", async ({ page }) => {
  const network = guard(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Read one post" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sample Author" })).toHaveCount(0);
  await expect(page.locator("article")).toHaveCount(0);
  network.assertQuiet();
});

test("loads a supplied snapshot with unicode, quote, and unavailable media", async ({ page }) => {
  const network = guard(page);
  await page.goto(readerPath(hostileSnapshot()));
  await expect(page.getByRole("heading", { level: 2, name: "Ada M. Example" })).toBeVisible();
  await expect(page.getByText("@ada_example")).toBeVisible();
  await expect(page.getByTestId("example-banner")).toHaveCount(0);

  const text = await page.getByTestId("post-text").innerText();
  expect(text).toContain("Line one with emoji 🌱 and 日本語.");
  expect(text).toContain("Second paragraph — em dash");
  expect(text).toContain("café");
  expect(text).toContain("<script>alert('xss')</script>");
  expect(text).toContain("javascript:alert(1)");
  expect(text).toContain("\n");

  const quote = page.getByRole("region", { name: "Quoted post" });
  await expect(quote).toBeVisible();
  await expect(quote.getByRole("heading", { name: "Quoted Poet" })).toBeVisible();
  const quoteText = await page.getByTestId("quote-text").innerText();
  expect(quoteText).toContain("A quoted line");
  expect(quoteText).toContain("with a second line · café");

  await expect(page.getByText("Photo unavailable")).toBeVisible();
  await expect(page.getByText("Video unavailable")).toBeVisible();
  await expect(page.getByText("Animation unavailable")).toBeVisible();
  await expect(page.getByText("Window light on a wooden desk")).toBeVisible();
  await expect(page.locator("article img, article iframe, article object, article embed")).toHaveCount(0);

  const safe = page.getByRole("link", { name: /example\.com\/field-notes/ });
  await expect(safe).toHaveAttribute("href", "https://example.com/field-notes?q=1");
  const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
  );
  for (const href of hrefs) {
    expect(href.toLowerCase()).not.toContain("javascript:");
    expect(href).not.toMatch(/x\.com|twitter\.com|t\.co|twimg\.com/i);
  }
  await expect(page.getByText("https://t.co/abcXYZ")).toBeVisible();
  await expect(page.getByText("https://pbs.twimg.com/media/abc.jpg")).toBeVisible();
  network.assertQuiet();
});

test("explains a raw X URL and rejects invalid or oversized input", async ({ page }) => {
  const network = guard(page);
  await page.goto("/");
  await page.getByLabel("Snapshot JSON").fill("https://x.com/someone/status/42");
  await page.getByRole("button", { name: "Read snapshot" }).click();
  const explanation = page.getByRole("region", { name: "A link is not the post" });
  await expect(explanation.getByRole("heading", { name: "A link is not the post" })).toBeVisible();
  await expect(explanation.getByText("https://x.com/someone/status/42")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "someone" })).toHaveCount(0);

  await page.getByLabel("Snapshot JSON").fill("{");
  await page.getByRole("button", { name: "Read snapshot" }).click();
  await expect(page.locator("#snapshot-error")).toContainText("not valid JSON");

  const base = hostileSnapshot();
  const oversized = {
    ...base,
    post: { ...base.post, text: "a".repeat(12_001) },
  };
  await page.getByLabel("Snapshot JSON").fill(JSON.stringify(oversized));
  await page.getByRole("button", { name: "Read snapshot" }).click();
  await expect(page.locator("#snapshot-error")).toContainText("12,000");

  await page.getByLabel("Upload JSON file").setInputFiles({
    name: "big.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(49 * 1024, 0x61),
  });
  await expect(page.locator("#snapshot-error")).toContainText("larger than 48 KB");

  await page.getByLabel("Snapshot JSON").fill(
    JSON.stringify({
      format: "single-post-snapshot",
      version: 1,
      post: {
        authorName: "Ada M. Example",
        authorHandle: "ada_example",
        text: "Nope",
        sourceUrl: "javascript:alert(1)",
      },
    }),
  );
  await page.getByRole("button", { name: "Read snapshot" }).click();
  await expect(page.locator("#snapshot-error")).toContainText("sourceUrl");
  network.assertQuiet();
});

test("roundtrips a reader link, download, and clipboard without calling X", async ({ page, context }) => {
  const network = guard(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(readerPath(hostileSnapshot()));
  await expect(page.getByTestId("post-text")).toContainText("日本語");

  const link = page.url();
  expect(link).toContain("/#s1.");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(link);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download JSON" }).click(),
  ]);
  const file = JSON.parse(fs.readFileSync(await download.path(), "utf8")) as {
    tracking?: string;
    post: { text: string; sourceUrl: string; quote: { text: string } };
  };
  expect(file.tracking).toBeUndefined();
  expect(file.post.text).toContain("日本語");
  expect(file.post.text).toContain("<script>alert('xss')</script>");
  expect(file.post.sourceUrl).toBe(STATUS_URL);
  expect(file.post.quote.text).toContain("café");

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 2, name: "Ada M. Example" })).toBeVisible();
  await expect(page.getByTestId("quote-text")).toContainText("A quoted line");

  await page.getByRole("button", { name: "Close post" }).click();
  await expect(page.getByRole("heading", { name: "Read one post" })).toBeVisible();
  expect(page.url()).not.toContain("#s1.");
  network.assertQuiet();
});

test("source control warns before any navigation to X", async ({ page }) => {
  const network = guard(page);
  await page.goto(readerPath(hostileSnapshot()));
  const popupPromise = page.waitForEvent("popup", { timeout: 1000 }).catch(() => null);
  await page.getByRole("button", { name: "Source on X", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Margin does not open it for you");
  await expect(dialog).toContainText(STATUS_URL);
  await page.keyboard.press("Enter");
  expect(await popupPromise).toBeNull();
  await expect(page).toHaveURL(/127\.0\.0\.1:43123/);

  await page.getByRole("button", { name: "Source on X", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open anyway" })).toHaveAttribute("href", STATUS_URL);
  await page.getByRole("button", { name: "Stay here" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/127\.0\.0\.1:43123/);
  await expect(page.locator("a[href*='x.com']:visible")).toHaveCount(0);
  network.assertQuiet();
});

test("labeled example is marked as invented", async ({ page }) => {
  const network = guard(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the example" }).click();
  await expect(page.getByTestId("example-banner")).toContainText("Not a real post");
  await expect(page.getByRole("heading", { level: 2, name: "Sample Author" })).toBeVisible();
  await expect(page.getByTestId("post-text")).toContainText("日本語");
  await expect(page.getByText("Photo unavailable")).toBeVisible();
  const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
  );
  expect(hrefs.some((href) => /x\.com|t\.co|twimg\.com|twitter\.com/i.test(href))).toBe(false);
  network.assertQuiet();
});

test("fits a phone width in light and dark themes", async ({ page }) => {
  const network = guard(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(readerPath(hostileSnapshot()));
  const author = page.getByRole("heading", { level: 2, name: "Ada M. Example" });
  await expect(author).toBeVisible();
  const box = await author.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(361);

  const textBox = await page.getByTestId("post-text").boundingBox();
  expect(textBox).not.toBeNull();
  expect(textBox!.x).toBeGreaterThanOrEqual(0);
  expect(textBox!.x + textBox!.width).toBeLessThanOrEqual(361);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const toggle = page.getByRole("button", { name: /Switch to (dark|light) theme/ });
  const startedDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(!startedDark);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
  network.assertQuiet();
});

test("opens a reader link pasted into the box", async ({ page }) => {
  const network = guard(page);
  await page.goto("/");
  await page.getByLabel("Snapshot JSON").fill(`http://127.0.0.1:43123${readerPath(hostileSnapshot())}`);
  await page.getByRole("button", { name: "Read snapshot" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Ada M. Example" })).toBeVisible();
  await expect(page.getByTestId("quote-text")).toContainText("A quoted line");
  network.assertQuiet();
});

test("shows the author's profile from the snapshot in a sheet", async ({ page }) => {
  const network = guard(page);
  const avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const base = hostileSnapshot();
  await page.goto(
    readerPath({
      ...base,
      post: {
        ...base.post,
        profile: {
          avatar,
          bio: "Distributed systems and coffee. https://example.com/notes",
          location: "Tokyo",
          website: "https://x.com/ada_example",
          joinedAt: "2014-03",
          followers: 12_400,
          following: 318,
          verified: true,
        },
      },
    }),
  );
  await expect(page.getByTestId("avatar-image").first()).toHaveAttribute("src", avatar);
  await expect(page.getByRole("img", { name: "Verified" }).first()).toBeVisible();

  await page.getByRole("button", { name: /View profile of Ada M\. Example/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Distributed systems and coffee.");
  await expect(sheet).toContainText("Tokyo");
  await expect(sheet).toContainText("Joined March 2014");
  await expect(sheet).toContainText("12.4K");
  await expect(sheet).toContainText("318");
  await expect(sheet.getByRole("link", { name: /example\.com\/notes/ })).toBeVisible();
  await expect(sheet.locator("a[href*='x.com']")).toHaveCount(0);
  await expect(sheet).toContainText("https://x.com/ada_example");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: /View profile of Quoted Poet/ }).click();
  await expect(page.getByRole("dialog")).toContainText("No profile was included");
  network.assertQuiet();
});
