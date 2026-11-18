import fc from "fast-check";

export const HOSTILE = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<b>x</b>",
  "&amp;&lt;&#x3C;",
  "{{constructor.constructor('alert(1)')()}}",
  "__proto__",
  "https://x.com/someone/status/1",
  "https://t.co/abc",
  "https://pbs.twimg.com/media/a.jpg",
  "https://example.com/field-notes?q=1.",
  "(https://example.com/a_(b))",
  "https://user:pass@example.com/",
  "https://example.com:8443/",
  "https://exa。mple.com/",
  "‮gnp.exe",
  "‏⁦rtl⁩",
  "\u0000\u0007\u001B\u007F",
  "\r\n\r",
  "\t  　",
  "café 日本語 🌳 👩🏽‍💻 é",
  "\uD800",
  "\uDFFF",
  "  ",
  "﻿",
];

/** Any text, mixing unicode, hostile markup, URLs, control characters and lone surrogates. */
export const hostileText = (maxLength = 12) =>
  fc
    .array(
      fc.oneof(
        { weight: 3, arbitrary: fc.string({ unit: "binary", maxLength: 20 }) },
        { weight: 3, arbitrary: fc.constantFrom(...HOSTILE) },
        { weight: 1, arbitrary: fc.webUrl({ withQueryParameters: true, withFragments: true }) },
        { weight: 1, arbitrary: fc.constantFrom(" ", "\n", ".", ")", "]", ",", "?") },
      ),
      { maxLength },
    )
    .map((pieces) => pieces.join(""));

const handle = fc.stringMatching(/^@?[A-Za-z0-9_]{1,15}$/);

const isoTime = fc
  .date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2090-12-31T23:59:59Z"), noInvalidDate: true })
  .map((date) => date.toISOString());

const statusUrl = fc
  .tuple(
    fc.constantFrom("https://x.com", "https://twitter.com", "https://mobile.twitter.com", "https://www.x.com"),
    fc.stringMatching(/^[A-Za-z0-9_]{1,15}$/),
    fc.stringMatching(/^[1-9]\d{0,18}$/),
    fc.constantFrom("", "?s=20", "#frag", "/photo/1", "/"),
  )
  .map(([origin, user, id, suffix]) => `${origin}/${user}/status/${id}${suffix}`);

const media = fc.record(
  {
    kind: fc.constantFrom("photo", "video", "gif", "audio"),
    alt: hostileText(4),
  },
  { requiredKeys: ["kind"] },
);

const profile = fc.record(
  {
    avatar: fc
      .tuple(fc.constantFrom("jpeg", "png", "webp"), fc.base64String({ minLength: 4, maxLength: 200 }))
      .filter(([, data]) => data.length > 0)
      .map(([type, data]) => `data:image/${type};base64,${data}`),
    bio: hostileText(6),
    location: fc.string({ maxLength: 60 }),
    website: fc.webUrl({ validSchemes: ["https"] }),
    joinedAt: fc.constantFrom("2014-03", "2014-03-21", "2014-03-01T00:30:00+09:00", "2009-12"),
    followers: fc.nat(),
    following: fc.nat(),
    posts: fc.nat(),
    verified: fc.boolean(),
  },
  { requiredKeys: [] },
);

const postFields = {
  authorName: fc.string({ unit: "grapheme", minLength: 1, maxLength: 40 }),
  authorHandle: handle,
  text: hostileText(),
  createdAt: isoTime,
  sourceUrl: statusUrl,
  lang: fc.constantFrom("en", "ja", "pt-BR", "zh-Hant-TW"),
  media: fc.array(media, { maxLength: 4 }),
  profile,
};

const quote = fc.record(postFields, { requiredKeys: ["authorName", "authorHandle", "text"] });

/** Raw snapshot objects in the shape a producer writes. Most, not all, are accepted by the parser. */
export const rawSnapshot = fc.record(
  {
    format: fc.constant("single-post-snapshot"),
    version: fc.constant(1),
    example: fc.boolean(),
    unknown: fc.jsonValue({ maxDepth: 2 }),
    post: fc.record(
      { ...postFields, quote },
      { requiredKeys: ["authorName", "authorHandle", "text"] },
    ),
  },
  { requiredKeys: ["format", "version", "post"] },
);
