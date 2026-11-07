"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImportPanel } from "@/components/import-panel";
import { PostView } from "@/components/post-view";
import { ThemeToggle } from "@/components/theme-toggle";
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

  async function present(
    snapshot: Snapshot,
    options: { replaceHash: boolean; ticket?: number },
  ) {
    const share = await buildShare(snapshot);
    if (options.ticket !== undefined && options.ticket !== generation.current) return;

    if (share.hash) {
      if (window.location.hash !== share.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}${share.hash}`);
      }
      setPhase({ kind: "post", snapshot, shareUrl: absolute(share.hash), shareNote: null });
    } else if (!options.replaceHash && window.location.hash.startsWith(`#s1.`)) {
      setPhase({
        kind: "post",
        snapshot,
        shareUrl: window.location.href,
        shareNote: null,
      });
    } else {
      if (options.replaceHash && window.location.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      setPhase({
        kind: "post",
        snapshot,
        shareUrl: null,
        shareNote: share.note,
      });
    }
    setShowImport(false);
    setDraft("");
  }

  async function readDraft() {
    const ticket = ++generation.current;
    setBusy(true);
    try {
      const result = classifyImport(draft);
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
      setPhase({
        kind: "invalid",
        message: `That file is larger than ${formatBytes(LIMITS.maxBytes)}.`,
      });
      setShowImport(true);
      return;
    }
    const text = await file.text();
    setDraft(text);
    const ticket = ++generation.current;
    setBusy(true);
    try {
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

  function clear() {
    generation.current += 1;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setPhase({ kind: "empty" });
    setDraft("");
    setShowImport(true);
  }

  const importError = phase.kind === "invalid" ? phase.message : null;

  return (
    <div className="min-h-dvh">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-serif text-2xl leading-none font-medium tracking-tight">Margin</h1>
            <p className="mt-1 text-sm text-muted-foreground">One post. No timeline.</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main id="content" className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {phase.kind === "post" ? (
          <PostView
            snapshot={phase.snapshot}
            shareUrl={phase.shareUrl}
            shareNote={phase.shareNote}
            headingRef={headingRef}
            onClear={clear}
            onImport={() => setShowImport(true)}
          />
        ) : phase.kind === "url-only" ? (
          <UrlOnly url={phase.url} x={phase.x} />
        ) : (
          <Intro />
        )}

        {phase.kind !== "post" || showImport ? (
          <ImportPanel
            draft={draft}
            error={importError}
            busy={busy}
            onDraft={setDraft}
            onRead={() => void readDraft()}
            onFile={(file) => void readFile(file)}
            onExample={() => {
              const ticket = ++generation.current;
              void present(EXAMPLE_SNAPSHOT, { replaceHash: true, ticket }).catch(() => {
                if (ticket !== generation.current) return;
                setPhase({ kind: "invalid", message: "Could not open the example." });
                setShowImport(true);
              });
            }}
          />
        ) : null}
      </main>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-10 text-sm leading-relaxed text-muted-foreground sm:px-6">
        Margin keeps the snapshot in this browser. It does not sign in, and it does not contact X.
      </footer>
    </div>
  );
}

function Intro() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-4xl leading-tight font-medium text-balance">Read one post</h2>
      <p className="text-lg leading-relaxed text-muted-foreground">
        Margin shows a single public post that someone hands you as a snapshot. It does not load a
        timeline, suggestions, or anything from X.
      </p>
      <p className="leading-relaxed">
        A link to the post is not enough. The text has to be inside the snapshot: display name,
        handle, full text, the time if it is known, and an optional source address. Quoted posts and
        media descriptions can come along. Pictures and video that live on X stay unavailable.
      </p>
      <details className="min-w-0 max-w-full rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Snapshot shape</summary>
        <p className="pb-2 text-sm leading-relaxed text-muted-foreground">
          Format <code>single-post-snapshot</code>, version <code>1</code>. The labeled example below
          is invented.
        </p>
        <pre className="max-w-full overflow-x-auto pb-2 font-mono text-xs leading-relaxed">
          {prettyJson(EXAMPLE_SNAPSHOT)}
        </pre>
      </details>
    </section>
  );
}

function UrlOnly({ url, x }: { url: string; x: boolean }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="url-only-title">
      <h2 id="url-only-title" className="font-serif text-4xl leading-tight font-medium text-balance">
        A link is not the post
      </h2>
      {x ? (
        <p className="text-lg leading-relaxed">
          Margin never contacts X, so this address has no text, name, or time to show. If x.com is
          blocked, that is left alone.
        </p>
      ) : (
        <p className="text-lg leading-relaxed">
          Margin does not fetch web addresses. This one has no post inside it.
        </p>
      )}
      <p className="font-mono text-sm leading-relaxed break-all text-muted-foreground">{url}</p>
      <p className="leading-relaxed">
        Ask for a snapshot of that public post, then paste the JSON, upload the file, or open the
        reader link. Nothing is filled in, because this page will not invent the post.
      </p>
    </section>
  );
}

async function buildShare(
  snapshot: Snapshot,
): Promise<{ hash: string | null; note: string | null }> {
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
