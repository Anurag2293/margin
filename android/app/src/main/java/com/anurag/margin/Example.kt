package com.anurag.margin

object Example {
    val snapshot = Snapshot(
        example = true,
        post = Post(
            authorName = "Sample Author",
            authorHandle = "sample_author",
            lang = "en",
            createdAt = "2026-04-02T16:30:00.000Z",
            text = listOf(
                "This page is for one post at a time.",
                "Line breaks stay put. So do accents (café), CJK characters (日本語), and an emoji 🌳.",
                "A regular https link can be opened: https://example.com/field-notes",
                "An address on X is shown as text and is not a link: https://x.com/sample_author/status/1",
            ).joinToString("\n\n"),
            profile = Profile(
                bio = "An invented author for Margin's example. Writes about quiet software and slow reading.",
                location = "Nowhere in particular",
                website = "https://example.com/sample",
                joinedAt = "2014-03",
                followers = 12_400,
                following = 318,
                verified = true,
            ),
            quote = Post(
                authorName = "Quoted Example",
                authorHandle = "quoted_example",
                createdAt = "2026-04-01T09:00:00.000Z",
                text = "Quoted lines stay inside the snapshot.\nThey are not fetched from anywhere.",
            ),
            media = listOf(Media(MediaKind.PHOTO, "Warm light on a wooden table, included as a description only.")),
        ),
    )
}
