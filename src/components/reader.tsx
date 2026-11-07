"use client";

import { EyeOff, Link2, Plus, ShieldCheck, Sparkle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImportPanel } from "@/components/import-panel";
import { PostView } from "@/components/post-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { EXAMPLE_SNAPSHOT } from "@/lib/example";
import { classifyImport } from "@/lib/import";
import { LIMITS, formatBytes } from "@/lib/limits";
import { decodeShareToken, encodeShareToken, shareHash, tokenFromHash, ShareTooLargeError } from "@/lib/share";
import { prettyJson, type Snapshot } from "@/lib/snapshot";

type Phase =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "url-only"; url: string; x: boolean }
  | { kind: "post"; snapshot: Snapshot; shareUrl: string | null; shareNote: string | null };

export function Reader() {
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const [draft, setDraft] = useState("");
  const [showImport, setShowImport] = useState(true);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);

  const loadHash = useCallback(async () => {
    const ticket = ++generation.current;
    const parsed = tokenFromHash(window.location.hash);
    if (parsed.kind === "empty") {
      if (ticket === generation.current) {
        setPhase({ kind: "empty" });
        setShowImport(true);
      }
      return;
    }
    if (parsed.kind === "foreign") {
      const result = classifyImport(parsed.raw);
      if (ticket !== generation.current) return;
      if (result.type === "url-only") setPhase({ kind: "url-only", url: result.url, x: result.x });
      else setPhase({ kind: "invalid", message: "This link is not a Margin snapshot." });
      setShowImport(true);
      return;
    }

    try {
      const decoded = await decodeShareToken(parsed.token);
      if (ticket !== generation.current) return;
      if (!decoded.ok) {
        setPhase({ kind: "invalid", message: decoded.error });
        setShowImport(true);
        return;
      }
      await present(decoded.snapshot, { replaceHash: true, ticket });
    } catch {
      if (ticket !== generation.current) return;
      setPhase({ kind: "invalid", message: "This reader link could not be opened." });
      setShowImport(true);
    }
  }, []);

  useEffect(() => {
    void loadHash();
    const onHash = () => void loadHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadHash]);

  useEffect(() => {
    if (phase.kind === "post") {
      document.title = phase.snapshot.example
        ? "Example — Margin"
        : `${phase.snapshot.post.authorName} — Margin`;
      headingRef.current?.focus({ preventScroll: false });
      return;
    }
    document.title = "Margin";
  }, [phase]);

  async function openToken(token: string, ticket: number) {
    try {
      const decoded = await decodeShareToken(token);
      if (ticket !== generation.current) return;
      if (!decoded.ok) {
        setPhase({ kind: "invalid", message: decoded.error });
        setShowImport(true);
        return;
      }
      await present(decoded.snapshot, { replaceHash: true, ticket });
    } catch {
      if (ticket !== generation.current) return;
      setPhase({ kind: "invalid", message: "This reader link could not be opened." });
      setShowImport(true);
    }
  }

  async function present(snapshot: Snapshot, options: { replaceHash: boolean; ticket?: number }) {
    const share = await buildShare(snapshot);
    if (options.ticket !== undefined && options.ticket !== generation.current) return;

    if (share.hash) {
      if (window.location.hash !== share.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}${share.hash}`);
      }
      setPhase({ kind: "post", snapshot, shareUrl: absolute(share.hash), shareNote: null });
    } else if (!options.replaceHash && window.location.hash.startsWith(`#s1.`)) {
      setPhase({ kind: "post", snapshot, shareUrl: window.location.href, shareNote: null });
    } else {
      if (options.replaceHash && window.location.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      setPhase({ kind: "post", snapshot, shareUrl: null, shareNote: share.note });
    }
    setShowImport(false);
    setDraft("");
  }

  async function readText(text: string) {
    const ticket = ++generation.current;
    setBusy(true);
    try {
      const token = readerLinkToken(text);
      if (token) {
        await openToken(token, ticket);
        return;
      }
      const result = classifyImport(text);
      if (ticket !== generation.current) return;
      if (result.type === "url-only") {
        setPhase({ kind: "url-only", url: result.url, x: result.x });
        setShowImport(true);
        return;
      }
      if (result.type === "invalid") {
        setPhase({ kind: "invalid", message: result.error });
        setShowImport(true);
        return;
      }
      await present(result.snapshot, { replaceHash: true, ticket });
    } catch {
      if (ticket === generation.current) {
        setPhase({ kind: "invalid", message: "Could not open that snapshot." });
        setShowImport(true);
      }
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }

  async function readFile(file: File) {
    if (file.size > LIMITS.maxBytes) {
      generation.current += 1;
      setPhase({ kind: "invalid", message: `That file is larger than ${formatBytes(LIMITS.maxBytes)}.` });
      setShowImport(true);
      return;
    }
    const text = await file.text();
    setDraft(text);
    await readText(text);
  }

  function showExample() {
    const ticket = ++generation.current;
    void present(EXAMPLE_SNAPSHOT, { replaceHash: true, ticket }).catch(() => {
      if (ticket !== generation.current) return;
      setPhase({ kind: "invalid", message: "Could not open the example." });
      setShowImport(true);
    });
  }

  function clear() {
    generation.current += 1;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setPhase({ kind: "empty" });
    setDraft("");
    setShowImport(true);
  }

  const importError = phase.kind === "invalid" ? phase.message : null;
  const reading = phase.kind === "post";

  const importPanel = (
    <ImportPanel
      draft={draft}
      error={importError}
      busy={busy}
      autoFocus={reading}
      onDraft={setDraft}
      onRead={(text) => void readText(text ?? draft)}
      onFile={(file) => void readFile(file)}
      onExample={showExample}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-15 w-full max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <h1 className="flex">
            <button
              type="button"
              className="flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={clear}
            >
              <Wordmark />
            </button>
          </h1>
          <div className="flex items-center gap-1">
            {reading ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-1.5 px-3"
                aria-expanded={showImport}
                onClick={() => setShowImport((value) => !value)}
              >
                {showImport ? <X /> : <Plus />}
                {showImport ? "Cancel" : "New"}
              </Button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="content"
        className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-14"
      >
        {phase.kind === "post" ? (
          <>
            {showImport ? <div className="rise">{importPanel}</div> : null}
            <PostView
              snapshot={phase.snapshot}
              shareUrl={phase.shareUrl}
              shareNote={phase.shareNote}
              headingRef={headingRef}
              onClear={clear}
            />
          </>
        ) : (
          <>
            {phase.kind === "url-only" ? <UrlOnly url={phase.url} x={phase.x} /> : <Intro />}
            {importPanel}
            {phase.kind !== "url-only" ? <HowItWorks /> : null}
          </>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:px-6">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        <span>No account, no tracking, no requests to X. The post lives in the link.</span>
      </footer>
    </div>
  );
}

function Intro() {
  return (
    <section className="rise flex flex-col gap-3 pt-2 sm:pt-6">
      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-primary uppercase">
        <span className="h-3.5 w-0.5 rounded-full bg-primary" aria-hidden="true" />
        One post. No timeline.
      </p>
      <h2 className="font-serif text-[2.5rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
        Read one post, and nothing else.
      </h2>
      <p className="max-w-prose text-[1.0625rem] leading-relaxed text-muted-foreground">
        Paste the snapshot someone handed you. Margin shows that post on a quiet page, with no feed, no
        account, and nothing loaded from X.
      </p>
    </section>
  );
}

const POINTS = [
  {
    Icon: Link2,
    title: "The post lives in the link",
    body: "A reader link carries the whole snapshot in its fragment. No server ever sees it.",
  },
  {
    Icon: EyeOff,
    title: "X stays blocked",
    body: "Nothing is fetched from x.com, t.co, or twimg.com. Media is described, never loaded.",
  },
  {
    Icon: Sparkle,
    title: "Nothing is invented",
    body: "A bare address has no text inside it, so Margin will not guess the post.",
  },
];

function HowItWorks() {
  return (
    <section aria-label="How Margin works" className="flex flex-col gap-4 pt-6">
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
        {POINTS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <details className="group mt-2 min-w-0 max-w-full rounded-xl border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Snapshot shape
          <Plus className="size-4 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true" />
        </summary>
        <div className="border-t border-border px-4 py-3">
          <p className="pb-3 text-sm leading-relaxed text-muted-foreground">
            Format <code className="font-mono text-foreground">single-post-snapshot</code>, version{" "}
            <code className="font-mono text-foreground">1</code>. This example is invented.
          </p>
          <pre className="max-w-full overflow-x-auto rounded-lg bg-muted px-3 py-3 font-mono text-xs leading-relaxed">
            {prettyJson(EXAMPLE_SNAPSHOT)}
          </pre>
        </div>
      </details>
    </section>
  );
}

function UrlOnly({ url, x }: { url: string; x: boolean }) {
  return (
    <section
      className="rise flex flex-col gap-3 rounded-2xl border border-border bg-accent/40 px-5 py-5 sm:px-6"
      aria-labelledby="url-only-title"
    >
      <h2 id="url-only-title" className="font-serif text-3xl leading-tight font-medium text-balance">
        A link is not the post
      </h2>
      <p className="leading-relaxed">
        {x
          ? "Margin never contacts X, so this address has no text, name, or time to show. If x.com is blocked, that is left alone."
          : "Margin does not fetch web addresses. This one has no post inside it."}
      </p>
      <p className="rounded-lg bg-card px-3 py-2 font-mono text-sm leading-relaxed break-all text-muted-foreground">
        {url}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Ask for a snapshot of that public post, then paste the JSON, upload the file, or open the reader
        link.
      </p>
    </section>
  );
}

function readerLinkToken(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return null;
  const candidate = /\s/.test(trimmed)
    ? trimmed.match(/https?:\/\/\S+#s1\.[A-Za-z0-9_-]+/)?.[0]
    : trimmed;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const parsed = tokenFromHash(url.hash);
    return parsed.kind === "token" ? parsed.token : null;
  } catch {
    return null;
  }
}

async function buildShare(snapshot: Snapshot): Promise<{ hash: string | null; note: string | null }> {
  try {
    const token = await encodeShareToken(snapshot);
    return { hash: shareHash(token), note: null };
  } catch (error) {
    if (error instanceof ShareTooLargeError) return { hash: null, note: error.message };
    throw error;
  }
}

function absolute(hash: string): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
}
