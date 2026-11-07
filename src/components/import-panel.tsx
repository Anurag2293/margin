"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, formatBytes } from "@/lib/limits";

export function ImportPanel({
  draft,
  error,
  busy,
  onDraft,
  onRead,
  onFile,
  onExample,
}: {
  draft: string;
  error: string | null;
  busy: boolean;
  onDraft: (value: string) => void;
  onRead: () => void;
  onFile: (file: File) => void;
  onExample: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a snapshot</CardTitle>
        <CardDescription>
          Paste JSON, upload a file, or open a reader link. Limit {formatBytes(LIMITS.maxBytes)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="snapshot-json">Snapshot JSON</Label>
          <Textarea
            id="snapshot-json"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onRead();
              }
            }}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "snapshot-error" : undefined}
            placeholder='{"format":"single-post-snapshot","version":1,"post":{...}}'
            className="min-h-36 max-h-64 text-base md:text-base"
          />
        </div>
        {error ? (
          <p id="snapshot-error" role="alert" className="text-sm leading-relaxed text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" className="min-h-11 px-3.5" disabled={busy} onClick={onRead}>
            Read snapshot
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-3.5"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 px-3.5"
            disabled={busy}
            onClick={onExample}
          >
            Show labeled example
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
      </CardContent>
    </Card>
  );
}
