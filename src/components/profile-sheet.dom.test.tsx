// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileSheet, ProfileTrigger } from "@/components/profile-sheet";
import type { Profile } from "@/lib/snapshot";

async function open(profile?: Profile, name = "Ada M. Example", handle = "ada_example") {
  render(
    <ProfileSheet name={name} handle={handle} profile={profile}>
      <div>
        <ProfileTrigger name={name} handle={handle} />
      </div>
    </ProfileSheet>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: `View profile of ${name} (@${handle})` }));
  });
  return screen.getByRole("dialog");
}

describe("ProfileSheet", () => {
  it("shows a full profile from the snapshot", async () => {
    const sheet = await open({
      avatar: "data:image/png;base64,AAAA",
      bio: "Line one\nhttps://example.com/notes and https://x.com/ada",
      location: "Tokyo",
      website: "https://www.example.com/",
      joinedAt: "2014-03",
      followers: 12_400,
      following: 318,
      posts: 1_500_000,
      verified: true,
    });
    expect(within(sheet).getByRole("heading", { name: /Ada M\. Example/ })).toBeTruthy();
    expect(within(sheet).getByRole("img", { name: "Verified" })).toBeTruthy();
    expect(sheet.textContent).toContain("@ada_example");
    expect(sheet.textContent).toContain("Tokyo");
    expect(sheet.textContent).toMatch(/Joined .*2014/);
    expect(sheet.textContent).toContain("12.4K");
    expect(sheet.textContent).toContain("318");
    expect(sheet.textContent).toContain("1.5M");
    expect(sheet.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    const site = within(sheet).getByRole("link", { name: "example.com" });
    expect(site.getAttribute("href")).toBe("https://www.example.com/");
    expect(site.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    const hrefs = Array.from(sheet.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href"));
    expect(hrefs).toEqual(["https://example.com/notes", "https://www.example.com/"]);
    expect(sheet.textContent).toContain("As captured in this snapshot");
  });

  it("shows an X website as text, not a link", async () => {
    const sheet = await open({ website: "https://x.com/ada" });
    expect(sheet.querySelector("a")).toBeNull();
    expect(sheet.querySelector(".blocked-url")?.textContent).toBe("https://x.com/ada");
  });

  it("shows a website with an IDN host as text", async () => {
    const sheet = await open({ website: "https://例え.jp/" });
    expect(sheet.querySelector("a")).toBeNull();
    expect(sheet.textContent).toContain("https://例え.jp/");
  });

  it("keeps the query in the shown website and drops a root path", async () => {
    const sheet = await open({ website: "https://example.com/?ref=bio" });
    expect(within(sheet).getByRole("link").textContent).toBe("example.com?ref=bio");
  });

  it("says when no profile was included", async () => {
    const sheet = await open(undefined);
    expect(sheet.textContent).toContain("No profile was included in this snapshot.");
    expect(sheet.querySelector("dl")).toBeNull();
  });

  it("shows zero counts", async () => {
    const sheet = await open({ followers: 0 });
    expect(sheet.querySelector("dl")?.textContent).toContain("0");
  });

  it("closes with Escape and the close button", async () => {
    await open({ bio: "Hi" });
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
