"use client";

import { ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SourceAction({
  url,
  label,
  className,
  short,
}: {
  url: string;
  label: string;
  className: string;
  short?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={className} aria-label={short ? label : undefined} title={short ? label : undefined}>
        <ExternalLink />
        {short ? <span className="max-sm:hidden">{short}</span> : label}
      </DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader className="gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle className="font-serif text-xl">This opens X</DialogTitle>
          <DialogDescription className="leading-relaxed">
            You blocked X so it would not load. Opening this address asks the browser to visit x.com or
            twitter.com anyway. Margin does not open it for you.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-relaxed break-all text-muted-foreground">
          {url}
        </p>
        <DialogFooter>
          <DialogClose
            render={<button type="button" className={buttonVariants({ className: "h-10 px-4" })} autoFocus />}
          >
            Stay here
          </DialogClose>
          {open ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className={buttonVariants({ variant: "outline", className: "h-10 px-4" })}
            >
              Open anyway
            </a>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
