import { linkify } from "@/lib/linkify";
import { cn } from "@/lib/utils";

export function PostText({
  text,
  testId,
  className,
}: {
  text: string;
  testId: string;
  className?: string;
}) {
  if (!text) {
    return (
      <p data-testid={testId} className="text-muted-foreground italic">
        No text was included in this snapshot.
      </p>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn("post-copy whitespace-pre-wrap wrap-anywhere", className)}
    >
      {linkify(text).map((part, index) => {
        if (part.type === "link") {
          return (
            <a
              key={index}
              href={part.href}
              rel="noopener noreferrer nofollow"
              target="_blank"
              referrerPolicy="no-referrer"
            >
              {part.value}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          );
        }
        if (part.type === "blocked") {
          return (
            <span
              key={index}
              className="blocked-url"
              title="Not linked. Margin does not open X addresses."
            >
              {part.value}
              <span className="sr-only"> (not linked)</span>
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}
