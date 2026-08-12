"use client";

import { trackError } from "@databuddy/sdk/react";
import type { ReactNode } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Cursor } from "@/components/icons/cursor";
import { Pill } from "@/components/pill";
import { getScoreData } from "@/lib/score";
import { cn, pluralize } from "@/lib/utils";

interface CardProps {
  score: number;
  warnings: number;
  errors: number;
}

interface ShareButtonProps {
  children: ReactNode;
  channel: string;
  href?: string;
  onClick?: () => void;
  score: number;
}

// window.location.origin is fixed for the lifetime of the page, so the
// store never notifies; the server snapshot ("") keeps SSR and hydration
// consistent without an effect-driven setState.
const subscribeToNothing = () => () => {
  // nothing to unsubscribe
};

const useOrigin = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ""
  );

const ShareButton = ({
  channel,
  href,
  onClick,
  score,
  children,
}: ShareButtonProps) => {
  if (href) {
    return (
      <a
        data-channel={channel}
        data-score={score}
        data-track="share_clicked"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "bg-card shadow-custom flex h-10 w-full items-center justify-center rounded-full text-sm sm:w-auto sm:flex-1",
          "hover:bg-accent transition-[background-color,transform,scale] duration-300 ease-[var(--ease-out)] active:scale-[0.96]"
        )}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      data-channel={channel}
      data-score={score}
      data-track="share_clicked"
      type="button"
      onClick={onClick}
      className={cn(
        "bg-card shadow-custom flex h-10 w-full items-center justify-center rounded-full text-sm sm:w-auto sm:flex-1",
        "hover:bg-accent transition-[background-color,transform,scale] duration-300 ease-[var(--ease-out)] active:scale-[0.96]"
      )}
    >
      {children}
    </button>
  );
};

export const Card = ({ score, warnings, errors }: CardProps) => {
  const { label, background, border } = getScoreData(score);

  const origin = useOrigin();

  const params = new URLSearchParams({
    e: String(errors),
    s: String(score),
    w: String(warnings),
  }).toString();

  const shareUrl = `${origin}/share?${params}`;

  const twitterUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
    text: `My Docker setup scored ${score}/100 (${label}) on Docker Doctor. Run it on yours:`,
    url: shareUrl,
  }).toString()}`;

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  const handleCopyBadge = useCallback(async () => {
    const badgeUrl = shareUrl.replace("/share?", "/share/badge?");
    const badge = `[![Docker Doctor](${badgeUrl})](${shareUrl})`;
    try {
      await navigator.clipboard.writeText(badge);
      toast.success("Badge copied");
    } catch (error) {
      toast.error(
        "Unable to copy. Check your browser's clipboard permissions and try again."
      );
      trackError(
        error instanceof Error ? error.message : "clipboard write failed",
        { error_type: "clipboard_badge_copy" }
      );
    }
  }, [shareUrl]);

  return (
    <div className="bg-card/20 shadow-custom flex flex-col items-center justify-center rounded-2xl p-1">
      <div className="preview-card relative flex size-full flex-col overflow-hidden rounded-xl">
        <div className="flex w-full grow flex-col items-center justify-center gap-5.5 pt-9.75 pb-6">
          <div className="flex flex-col items-center gap-2.25">
            <Pill className="shadow-custom">{label}</Pill>
            <h2 className="text-2xl font-semibold tracking-[-0.01em] text-balance">
              My Infrastructure Setup
            </h2>
          </div>

          <div
            className={cn(
              "relative flex size-20 shrink-0 items-center justify-center border",
              border
            )}
          >
            <div className="bg-card shadow-custom relative flex size-18 items-center justify-center rounded-full">
              <span className="text-foreground text-3xl font-medium tabular-nums">
                {score}
                <span className="sr-only"> out of 100</span>
              </span>
            </div>
            <div className={cn("absolute inset-0", background)} />
            <Cursor
              aria-hidden="true"
              className="absolute -right-3 -bottom-3 size-8"
            />
          </div>

          <div className="flex gap-1.5">
            <Pill contrast="low" variant={errors > 0 ? "red" : "gray"}>
              {pluralize(errors, "error")}
            </Pill>
            <Pill contrast="low" variant={warnings > 0 ? "amber" : "gray"}>
              {pluralize(warnings, "warning")}
            </Pill>
          </div>
        </div>

        <div className="border-border flex w-full flex-col items-stretch gap-2 [border-top-width:0.5px] px-4 pt-3 pb-3.75 sm:flex-row sm:items-center">
          <ShareButton channel="x" href={twitterUrl} score={score}>
            Share on X
          </ShareButton>
          <ShareButton channel="linkedin" href={linkedinUrl} score={score}>
            Share on LinkedIn
          </ShareButton>
          <ShareButton channel="badge" onClick={handleCopyBadge} score={score}>
            Copy GitHub badge
          </ShareButton>
        </div>
      </div>
    </div>
  );
};
