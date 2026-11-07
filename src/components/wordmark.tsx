export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-foreground" />
        <rect x="10" y="6" width="2" height="20" rx="1" className="fill-primary" />
        <rect x="15" y="10" width="10" height="2" rx="1" className="fill-background" />
        <rect x="15" y="15" width="10" height="2" rx="1" className="fill-background" />
        <rect x="15" y="20" width="6" height="2" rx="1" className="fill-background" />
      </svg>
      <span className="font-serif text-[1.35rem] leading-none font-medium tracking-tight">Margin</span>
    </span>
  );
}
