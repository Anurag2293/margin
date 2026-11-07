"use client";

import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { PostText } from "@/components/post-text";
import { SourceAction } from "@/components/source-action";
import { prettyJson, type Media, type Quote, type Snapshot } from "@/lib/snapshot";

const MEDIA_LABEL: Record<Media["kind"], string> = {
  photo: "Photo",
  video: "Video",
  gif: "Animation",
  audio: "Audio",
};

export function PostView({
  snapshot,
  shareUrl,
  shareNote,
  headingRef,
  onClear,
  onImport,
}: {
  snapshot: Snapshot;
  shareUrl: string | null;
  shareNote: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClear: () => void;
  onImport: () => void;
}) {
  const post = snapshot.post;
  const [copied, setCopied] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyNote(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyNote("Select the reader link and copy it from the field.");
    }
  }

  function download() {
    const blob = new Blob([prettyJson(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `margin-${post.authorHandle}.json`;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article aria-labelledby="post-author" lang={post.lang} className="flex min-w-0 flex-col gap-6">
      {snapshot.example ? (
        <p role="note" data-testid="example-banner" className="example-banner">
          Example. Invented to show this page. Not a real post and not from X.
        </p>
      ) : null}

      <header className="flex flex-col gap-1">
        <h2
          id="post-author"
          ref={headingRef}
          tabIndex={-1}
          dir="auto"
          className="scroll-mt-24 font-serif text-3xl leading-tight font-medium text-balance outline-none"
        >
          {post.authorName}
        </h2>
        <p className="text-muted-foreground" dir="ltr">
          <span className="sr-only">Handle </span>@{post.authorHandle}
        </p>
        <Timestamp value={post.createdAt} />
      </header>

      <PostText
        text={post.text}
        testId="post-text"
        className="font-serif text-[1.125rem] leading-8 sm:text-[1.3125rem] sm:leading-9"
      />

      <MediaList media={post.media} />

      {post.quote ? <Quoted quote={post.quote} /> : null}

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        {shareUrl ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="reader-link" className="text-sm font-medium">
              Reader link
            </label>
            <input
              id="reader-link"
              data-testid="reader-link"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-card px-3 font-mono text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
        ) : null}
        {shareNote ? (
          <p role="status" className="text-sm leading-relaxed text-muted-foreground">
            {shareNote}
          </p>
        ) : null}
        {copyNote ? (
          <p role="status" className="text-sm text-muted-foreground">
            {copyNote}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {shareUrl ? (
            <Button type="button" className="min-h-11 px-3.5" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy reader link"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11 px-3.5" onClick={download}>
            Download JSON
          </Button>
          {post.sourceUrl ? <SourceAction url={post.sourceUrl} label="Source on X" /> : null}
          <Button type="button" variant="ghost" className="min-h-11 px-3.5" onClick={onImport}>
            Import another
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 px-3.5" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </article>
  );
}

function Quoted({ quote }: { quote: Quote }) {
  return (
    <section
      aria-labelledby="quoted-post-label"
      lang={quote.lang}
      className="rounded-xl bg-secondary/70 px-4 py-4 sm:px-5"
    >
      <p id="quoted-post-label" className="mb-2 text-sm text-muted-foreground">
        Quoted post
      </p>
      <h3 dir="auto" className="font-serif text-xl leading-snug font-medium">
        {quote.authorName}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
        <span className="sr-only">Quoted handle </span>@{quote.authorHandle}
      </p>
      <div className="mt-1">
        <Timestamp value={quote.createdAt} />
      </div>
      <div className="mt-3">
        <PostText text={quote.text} testId="quote-text" className="font-serif text-lg leading-8" />
      </div>
      <div className="mt-4">
        <MediaList media={quote.media} />
      </div>
      {quote.sourceUrl ? (
        <div className="mt-4">
          <SourceAction url={quote.sourceUrl} label="Quoted source on X" />
        </div>
      ) : null}
    </section>
  );
}

function MediaList({ media }: { media?: Media[] }) {
  if (!media?.length) return null;
  return (
    <ul aria-label="Media in this snapshot" className="flex flex-col gap-3">
      {media.map((item, index) => (
        <li key={`${item.kind}-${index}`} className="media-note" data-testid="media-note">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {MEDIA_LABEL[item.kind]} unavailable
          </p>
          <p className="mt-1 leading-relaxed">
            This reader does not load images, video, or audio from X.
          </p>
          {item.alt ? (
            <p className="mt-2 leading-relaxed" dir="auto">
              <span className="text-muted-foreground">Description. </span>
              {item.alt}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Timestamp({ value }: { value?: string }) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">Time not included</p>;
  }
  const label = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
  return (
    <time dateTime={value} className="text-sm text-muted-foreground" title={value}>
      {label}
    </time>
  );
}
