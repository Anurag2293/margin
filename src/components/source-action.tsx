"use client";

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

export function SourceAction({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", className: "min-h-11 px-3.5" })}>
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This opens X</DialogTitle>
          <DialogDescription>
            You blocked X so it would not load. Opening this address asks the
            browser to visit x.com or twitter.com anyway. Margin does not open
            it for you.
          </DialogDescription>
        </DialogHeader>
        <p className="font-mono text-xs leading-relaxed break-all text-muted-foreground">
          {url}
        </p>
        <DialogFooter>
          <DialogClose
            render={<button type="button" className={buttonVariants({ className: "min-h-11 px-3.5" })} autoFocus />}
          >
            Stay here
          </DialogClose>
          {open ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className={buttonVariants({ variant: "outline", className: "min-h-11 px-3.5" })}
            >
              Open anyway
            </a>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
