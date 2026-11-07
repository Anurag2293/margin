"use client";

import { ArrowRight, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LIMITS, formatBytes } from "@/lib/limits";
import { cn } from "@/lib/utils";

export function ImportPanel({
  draft,
  error,
  busy,
  autoFocus = false,
  onDraft,
  onRead,
  onFile,
  onExample,
}: {
  draft: string;
  error: string | null;
  busy: boolean;
  autoFocus?: boolean;
  onDraft: (value: string) => void;
  onRead: (text?: string) => void;
  onFile: (file: File) => void;
  onExample: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  return (
    <section aria-label="Add a snapshot" className="flex flex-col gap-2">
      <div
        className={cn(
          "paper rounded-2xl transition-shadow focus-within:ring-3 focus-within:ring-ring/30",
          dragging && "ring-3 ring-ring/50",
          error && "ring-3 ring-destructive/25",
        )}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          event.preventDefault();
          setDragging(false);
          onFile(file);
        }}
      >
        <label htmlFor="snapshot-json" className="sr-only">
          Snapshot JSON
        </label>
        <textarea
          id="snapshot-json"
          ref={textRef}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (draft.trim() || !pasted.trim()) return;
            event.preventDefault();
            onDraft(pasted);
            onRead(pasted);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onRead();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "snapshot-error" : "snapshot-hint"}
          placeholder="Paste snapshot JSON or a reader link"
          className="block max-h-72 min-h-32 w-full resize-none bg-transparent px-5 pt-4 pb-2 font-mono text-[0.9375rem] leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 px-3 text-muted-foreground hover:text-foreground"
            disabled={busy}
            aria-label="Upload JSON"
            title="Upload JSON"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            <span className="max-sm:hidden">Upload JSON</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 px-3 text-muted-foreground hover:text-foreground"
            disabled={busy}
            aria-label="Try the example"
            onClick={onExample}
          >
            <Sparkles />
            <span className="sm:hidden">Example</span>
            <span className="max-sm:hidden">Try the example</span>
          </Button>
          <Button
            type="button"
            className="ml-auto h-10 gap-2 rounded-xl px-4"
            disabled={busy}
            onClick={() => onRead()}
          >
            Read snapshot
            <span className="kbd max-sm:hidden" aria-hidden="true">
              {mac ? "⌘" : "Ctrl"} ↵
            </span>
            <ArrowRight className="sm:hidden" />
          </Button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json,text/json"
            aria-label="Upload JSON file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
        </div>
      </div>
      {error ? (
        <p id="snapshot-error" role="alert" className="px-1 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      ) : (
        <p id="snapshot-hint" className="px-1 text-sm text-muted-foreground">
          JSON up to {formatBytes(LIMITS.maxBytes)}. You can also drop a .json file here.
        </p>
      )}
    </section>
  );
}
