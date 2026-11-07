# Margin

A quiet page for one public post. Someone hands you a snapshot — the name, the handle, the full text, and whatever else they were able to copy — and Margin shows that post. It does not load a timeline, suggestions, notifications, or anything from X.

An address on its own is not enough. Margin never signs in, never uses an API key, and never requests `x.com`, `twitter.com`, `t.co`, or `twimg.com`. If those names are blocked on purpose, this page leaves them blocked.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run test:e2e
```

The browser tests use Chromium. The first `npm run test:e2e` needs `npx playwright install chromium`.

## How to read a post

1. Paste snapshot JSON, upload the `.json` file, or open a reader link.
2. Or press **Show labeled example**. That post is invented. It is marked on the page, and it is not from X.

Pasting `https://x.com/someone/status/123` explains why nothing can be shown. The page does not invent the missing text.

**Source on X** is optional. It asks first, and it tells you that X is blocked. Choosing **Stay here** leaves you on Margin.

Pictures, video, GIF, and audio are described, not fetched. If the snapshot includes a written description, that description is shown.

## Snapshot format

Version 1. The JSON Schema is `schema/single-post-snapshot.v1.json`. The running app is the validator: unknown fields are ignored, except URL fields on media, which are rejected.

```json
{
  "format": "single-post-snapshot",
  "version": 1,
  "post": {
    "authorName": "Ada M. Example",
    "authorHandle": "ada_example",
    "text": "Full text, with line breaks kept.",
    "createdAt": "2026-01-15T18:04:00.000Z",
    "sourceUrl": "https://x.com/ada_example/status/1234567890123456789",
    "lang": "en",
    "quote": {
      "authorName": "Quoted Poet",
      "authorHandle": "poet_example",
      "text": "One level of quote. No quote inside a quote."
    },
    "media": [
      { "kind": "photo", "alt": "Window light on a desk" }
    ]
  }
}
```

| Field | Required | Rule |
| --- | --- | --- |
| `format` | yes | Exactly `single-post-snapshot`. |
| `version` | yes | Number `1`, not the string `"1"`. |
| `example` | no | `true` shows an “invented example” banner. Omit it for a real post. |
| `post.authorName` | yes | 1–50 characters after trimming. |
| `post.authorHandle` | yes | 1–15 letters, numbers, or underscores. A leading `@` is accepted and removed. |
| `post.text` | yes | Up to 12,000 UTF-16 code units. Line breaks stay. Empty text is allowed only when `media` is present. |
| `post.createdAt` | no | ISO-8601 with a time, such as `2026-04-02T16:30:00.000Z`. Omit it when the time is unknown. |
| `post.sourceUrl` | no | `https://x.com/{handle}/status/{id}` or the `twitter.com` / `mobile.twitter.com` / `/i/web/status/{id}` forms. Query, hash, and `/photo/1` are dropped. Any other address is rejected. |
| `post.lang` | no | A short language tag such as `en` or `pt-BR`. |
| `post.quote` | no | Same fields as a post, except it cannot contain another `quote`. |
| `post.media` | no | At most 4 items. `kind` is `photo`, `video`, `gif`, or `audio`. `alt` is optional text up to 1,000 characters. `url`, `src`, `href`, `source`, `previewUrl`, and `poster` are rejected. |

The whole JSON file must be at most **48 KB** of UTF-8. Leading and trailing whitespace is removed. NUL and other control characters are stripped. A BOM is ignored.

Text is shown as text. It is not HTML.

## Reader links

A reader link carries the snapshot in the URL fragment. The fragment is not sent to the server.

```text
{origin}/#s1.{token}
```

`token` is unpadded base64url of **raw deflate** (RFC 1951, no zlib header and no gzip header) of the UTF-8 JSON.

- Node: `zlib.deflateRawSync(buffer).toString("base64url")`
- Python: `zlib.compressobj(wbits=-15)`, then `base64.urlsafe_b64encode(raw).rstrip(b"=")`
- Browser: `CompressionStream("deflate-raw")`, then base64url

Tokens are not byte-identical across compressors. Readers inflate the token; they do not compare it as a hash of the JSON. The token may be at most **8,000** characters. Past that, send the `.json` file instead. Unpacking stops at 48 KB so a tiny token cannot expand without limit.

From this repo:

```bash
node scripts/reader-link.mjs http://127.0.0.1:43123 < post.json
```

The script checks that the input is JSON within the size limit. The page checks the fields.

Key order does not matter. `https://x.com/...` inside the post text is shown as text and is not a link. Other default-port `https://` links can be opened. `javascript:`, credentials, and non-default ports are not links.

## What this page will not do

- No account, cookies, API key, or paid service.
- No request to X, from the page or from a server, to fill in a missing post.
- No timeline, recommendations, trending, infinite scroll, notifications, or embeds.
- No remote image, video, or audio, including from a CDN.
- No HTML from the snapshot, and no fetch of a URL the snapshot mentions.

Share links contain the post text. Anyone with the link can read it. The fragment is visible in the browser even though it is not sent with the HTTP request.
