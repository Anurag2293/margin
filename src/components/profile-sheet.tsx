"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { BadgeCheck, CalendarDays, ChevronRight, Link2, MapPin, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostText } from "@/components/post-text";
import { classify } from "@/lib/linkify";
import type { Profile } from "@/lib/snapshot";

export function ProfileTrigger({ name, handle }: { name: string; handle: string }) {
  return (
    <DialogPrimitive.Trigger
      className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      aria-label={`View profile of ${name} (@${handle})`}
    />
  );
}

export function ProfileChevron() {
  return <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground/70" />;
}

export function VerifiedBadge({ className = "size-4" }: { className?: string }) {
  return (
    <BadgeCheck
      role="img"
      aria-label="Verified"
      className={`${className} shrink-0 fill-primary text-primary-foreground`}
    />
  );
}

export function ProfileSheet({
  name,
  handle,
  profile,
  children,
}: {
  name: string;
  handle: string;
  profile?: Profile;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root>
      {children}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-testid="profile-sheet"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-3xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-popover-foreground outline-none duration-250 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:px-6 sm:pt-6 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95"
        >
          <span aria-hidden="true" className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" />
          <DialogPrimitive.Close
            aria-label="Close profile"
            className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:hidden"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>

          <div className="flex items-center gap-4">
            <Avatar name={name} handle={handle} src={profile?.avatar} className="size-16 text-xl" />
            <div className="min-w-0">
              <DialogPrimitive.Title className="flex items-center gap-1.5 text-lg leading-snug font-semibold">
                <span dir="auto" className="wrap-anywhere">
                  {name}
                </span>
                {profile?.verified ? <VerifiedBadge /> : null}
              </DialogPrimitive.Title>
              <p className="text-sm text-muted-foreground" dir="ltr">
                @{handle}
              </p>
            </div>
          </div>

          {profile?.bio ? (
            <PostText text={profile.bio} testId="profile-bio" className="mt-4 text-[0.9375rem] leading-relaxed" />
          ) : null}

          <ProfileFacts profile={profile} />
          <ProfileStats profile={profile} />

          <DialogPrimitive.Description className="mt-5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            {profile
              ? "As captured in this snapshot. Margin does not look profiles up on X."
              : "No profile was included in this snapshot. Margin does not look profiles up on X."}
          </DialogPrimitive.Description>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ProfileFacts({ profile }: { profile?: Profile }) {
  if (!profile?.location && !profile?.website && !profile?.joinedAt) return null;
  const site = profile.website ? classify(profile.website) : null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
      {profile.location ? (
        <li className="flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Location: </span>
          <span dir="auto" className="wrap-anywhere">
            {profile.location}
          </span>
        </li>
      ) : null}
      {site ? (
        <li className="flex min-w-0 items-center gap-1.5">
          <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Website: </span>
          {site.type === "link" ? (
            <a
              href={site.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className="wrap-anywhere text-foreground underline decoration-primary underline-offset-2"
            >
              {displayUrl(site.href)}
            </a>
          ) : (
            <span className={site.type === "blocked" ? "blocked-url wrap-anywhere" : "wrap-anywhere"}>
              {site.value}
            </span>
          )}
        </li>
      ) : null}
      {profile.joinedAt ? (
        <li className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          Joined {formatJoined(profile.joinedAt)}
        </li>
      ) : null}
    </ul>
  );
}

function ProfileStats({ profile }: { profile?: Profile }) {
  const stats = [
    ["following", profile?.following],
    ["followers", profile?.followers],
    ["posts", profile?.posts],
  ].filter((entry): entry is [string, number] => typeof entry[1] === "number");
  if (!stats.length) return null;
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {stats.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1">
          <dt className="sr-only">{label}</dt>
          <dd className="font-semibold tabular-nums" title={value.toLocaleString()}>
            {formatCount(value)}
          </dd>
          <span aria-hidden="true" className="text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </dl>
  );
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatJoined(value: string): string {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function displayUrl(href: string): string {
  const url = new URL(href);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.hostname.replace(/^www\./, "")}${path}${url.search}`;
}
