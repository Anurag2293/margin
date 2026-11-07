import type { Snapshot } from "@/lib/snapshot";

/** Invented sample. It is not a real post and not fetched from anywhere. */
export const EXAMPLE_SNAPSHOT: Snapshot = {
  format: "single-post-snapshot",
  version: 1,
  example: true,
  post: {
    authorName: "Sample Author",
    authorHandle: "sample_author",
    lang: "en",
    createdAt: "2026-04-02T16:30:00.000Z",
    text: [
      "This page is for one post at a time.",
      "Line breaks stay put. So do accents (café), CJK characters (日本語), and an emoji 🌳.",
      "A regular https link can be opened: https://example.com/field-notes",
      "An address on X is shown as text and is not a link: https://x.com/sample_author/status/1",
    ].join("\n\n"),
    quote: {
      authorName: "Quoted Example",
      authorHandle: "quoted_example",
      createdAt: "2026-04-01T09:00:00.000Z",
      text: "Quoted lines stay inside the snapshot.\nThey are not fetched from anywhere.",
    },
    media: [
      {
        kind: "photo",
        alt: "Warm light on a wooden table, included as a description only.",
      },
    ],
  },
};
