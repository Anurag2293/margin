"use client";

import { Check, Download, ImageOff, Link2, VideoOff, VolumeX, X } from "lucide-react";
import { useState, type ComponentType, type RefObject } from "react";
import { Avatar } from "@/components/avatar";
import { PostText } from "@/components/post-text";
import { ProfileChevron, ProfileSheet, ProfileTrigger, VerifiedBadge } from "@/components/profile-sheet";
import { SourceAction } from "@/components/source-action";
import { buttonVariants } from "@/components/ui/button";
import { prettyJson, type Media, type Quote, type Snapshot } from "@/lib/snapshot";

const MEDIA: Record<Media["kind"], { label: string; Icon: ComponentType<{ className?: string }> }> = {
  photo: { label: "Photo", Icon: ImageOff },
  video: { label: "Video", Icon: VideoOff },
  gif: { label: "Animation", Icon: VideoOff },
  audio: { label: "Audio", Icon: VolumeX },
};

const toolButton = buttonVariants({
  variant: "ghost",
  className: "h-10 gap-2 px-2.5 text-muted-foreground hover:text-foreground sm:px-3",
});

export function PostView({
  snapshot,
  shareUrl,
  shareNote,
  headingRef,
  onClear,
}: {
  snapshot: Snapshot;
  shareUrl: string | null;
  shareNote: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClear: () => void;
}) {
  const post = snapshot.post;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
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
    <article aria-labelledby="post-author" lang={post.lang} className="rise flex min-w-0 flex-col gap-4">
      {snapshot.example ? (
        <p
          role="note"
          data-testid="example-banner"
          className="self-start rounded-full bg-accent px-3.5 py-1.5 text-sm text-accent-foreground"
        >
          Example. Invented to show this page. Not a real post and not from X.
        </p>
      ) : null}

      <div className="paper min-w-0 rounded-2xl">
        <div className="flex flex-col gap-5 px-5 pt-5 sm:px-8 sm:pt-7">
          <ProfileSheet name={post.authorName} handle={post.authorHandle} profile={post.profile}>
            <header className="relative -mx-2 flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
              <ProfileTrigger name={post.authorName} handle={post.authorHandle} />
              <Avatar
                name={post.authorName}
                handle={post.authorHandle}
                src={post.profile?.avatar}
                className="size-11 text-sm"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <h2
                    id="post-author"
                    ref={headingRef}
                    tabIndex={-1}
                    dir="auto"
                    className="scroll-mt-24 truncate text-[1.05rem] leading-snug font-semibold outline-none"
                  >
                    {post.authorName}
                  </h2>
                  {post.profile?.verified ? <VerifiedBadge /> : null}
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                  <span dir="ltr">
                    <span className="sr-only">Handle </span>@{post.authorHandle}
                  </span>
                  <span className="whitespace-nowrap">
                    <span aria-hidden="true">· </span>
                    <Timestamp value={post.createdAt} />
                  </span>
                </p>
              </div>
              <ProfileChevron />
            </header>
          </ProfileSheet>

          <PostText
            text={post.text}
            testId="post-text"
            className="font-serif text-[1.1875rem] leading-[1.65] sm:text-[1.3125rem]"
          />

          <MediaList media={post.media} />

          {post.quote ? <Quoted quote={post.quote} /> : null}
        </div>

        <div className="mt-6 flex items-center gap-0.5 border-t border-border px-2 py-1.5 sm:px-4">
          {shareUrl ? (
            <button
              type="button"
              className={toolButton}
              aria-label={copied ? "Copied" : "Copy link"}
              onClick={() => void copyLink()}
            >
              {copied ? <Check className="text-primary" /> : <Link2 />}
              <span className="max-[380px]:hidden">{copied ? "Copied" : "Copy link"}</span>
            </button>
          ) : null}
          <button
            type="button"
            className={toolButton}
            aria-label="Download JSON"
            title="Download JSON"
            onClick={download}
          >
            <Download />
            <span className="max-sm:hidden">JSON</span>
          </button>
          {post.sourceUrl ? (
            <SourceAction url={post.sourceUrl} label="Source on X" className={toolButton} short="Source" />
          ) : null}
          <button
            type="button"
            className={`${toolButton} ml-auto`}
            aria-label="Close post"
            title="Close post"
            onClick={onClear}
          >
            <X />
          </button>
        </div>
      </div>

      {shareNote ? (
        <p role="status" className="px-1 text-sm leading-relaxed text-muted-foreground">
          {shareNote}
        </p>
      ) : null}
      {copyFailed && shareUrl ? (
        <div className="flex flex-col gap-2 px-1">
          <label htmlFor="reader-link" className="text-sm text-muted-foreground">
            Copying was blocked. Select the reader link and copy it here.
          </label>
          <input
            id="reader-link"
            data-testid="reader-link"
            readOnly
            autoFocus
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>
      ) : null}
    </article>
  );
}

function Quoted({ quote }: { quote: Quote }) {
  return (
    <section
      aria-labelledby="quoted-post-label"
      lang={quote.lang}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border border-l-2 border-l-paper-line bg-background/50 px-4 py-4 sm:px-5"
    >
      <p id="quoted-post-label" className="sr-only">
        Quoted post
      </p>
      <ProfileSheet name={quote.authorName} handle={quote.authorHandle} profile={quote.profile}>
        <header className="relative -mx-1.5 -my-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/60">
          <ProfileTrigger name={quote.authorName} handle={quote.authorHandle} />
          <Avatar
            name={quote.authorName}
            handle={quote.authorHandle}
            src={quote.profile?.avatar}
            className="size-6 text-[0.6rem]"
          />
          <h3 dir="auto" className="text-sm font-semibold wrap-anywhere">
            {quote.authorName}
          </h3>
          {quote.profile?.verified ? <VerifiedBadge className="size-3.5" /> : null}
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span dir="ltr">
              <span className="sr-only">Quoted handle </span>@{quote.authorHandle}
            </span>
            {quote.createdAt ? (
              <span className="whitespace-nowrap">
                <span aria-hidden="true">· </span>
                <Timestamp value={quote.createdAt} dateOnly />
              </span>
            ) : null}
          </p>
        </header>
      </ProfileSheet>
      <PostText text={quote.text} testId="quote-text" className="font-serif text-[1.0625rem] leading-relaxed" />
      <MediaList media={quote.media} />
      {quote.sourceUrl ? (
        <div>
          <SourceAction
            url={quote.sourceUrl}
            label="Quoted source on X"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "-ml-2 h-8 gap-1.5 text-muted-foreground hover:text-foreground",
            })}
          />
        </div>
      ) : null}
    </section>
  );
}

function MediaList({ media }: { media?: Media[] }) {
  if (!media?.length) return null;
  return (
    <ul aria-label="Media in this snapshot" className="flex flex-col gap-2">
      {media.map((item, index) => {
        const { label, Icon } = MEDIA[item.kind];
        return (
          <li
            key={`${item.kind}-${index}`}
            data-testid="media-note"
            className="flex gap-3 rounded-xl bg-muted/70 px-4 py-3"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {label} unavailable
                <span className="font-normal text-muted-foreground"> · not loaded from X</span>
              </p>
              {item.alt ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground wrap-anywhere" dir="auto">
                  <span className="sr-only">Description. </span>
                  {item.alt}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Timestamp({ value, dateOnly = false }: { value?: string; dateOnly?: boolean }) {
  if (!value) return <span>Time not included</span>;
  const label = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: dateOnly ? undefined : "short",
  }).format(new Date(value));
  return (
    <time dateTime={value} title={value}>
      {label}
    </time>
  );
}
