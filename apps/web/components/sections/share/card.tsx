"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";

import { Cursor } from "@/components/icons/cursor";
import { getScoreData } from "@/lib/score";
import { cn, pluralize } from "@/lib/utils";

interface CardProps {
  score: number;
  warnings: number;
  errors: number;
}

interface PillProps {
  children: ReactNode;
}

const Pill = ({ children }: PillProps) => (
  <div className="flex h-7 shrink-0 items-center justify-center rounded-full bg-muted px-3">
    <span className="text-sm font-medium">{children}</span>
  </div>
);

interface ShareButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}

const ShareButton = ({ href, onClick, children }: ShareButtonProps) => {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex flex-1 items-center justify-center h-10 rounded-full bg-card shadow-custom text-sm",
          "hover:bg-accent transition-[background-color,transform,scale] duration-300 ease-[var(--ease-out)] active:scale-[0.96]"
        )}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center h-10 rounded-full bg-card shadow-custom text-sm",
        "hover:bg-accent transition-[background-color,transform,scale] duration-300 ease-[var(--ease-out)] active:scale-[0.96]"
      )}
    >
      {children}
    </button>
  );
};

export const Card = ({ score, warnings, errors }: CardProps) => {
  const { label, background, border } = getScoreData(score);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
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
    } catch {
      // clipboard not available
    }
  }, [shareUrl]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card/20 p-1 shadow-custom group-focus-visible:ring-2">
      <div className="relative flex size-full flex-col overflow-hidden rounded-xl preview-card">
        <div className="flex w-full grow flex-col items-center justify-center gap-5.5 pt-9.75 pb-6">
          <div className="flex flex-col items-center gap-2.25">
            <Pill>{label}</Pill>
            <p className="text-balance text-2xl font-semibold tracking-[-0.01em]">
              My Infrastructure Setup
            </p>
          </div>

          <div
            className={cn(
              "relative flex size-20 shrink-0 items-center justify-center border",
              border
            )}
          >
            <div className="relative flex size-18 items-center justify-center rounded-full bg-card shadow-custom select-none">
              <span className="text-3xl font-medium tabular-nums text-white">
                {score}
              </span>
            </div>
            <div className={cn("absolute inset-0", background)} />
            <Cursor className="absolute -right-3 -bottom-3 size-8" />
          </div>

          <div className="flex gap-1.5">
            <Pill>{pluralize(errors, "error")}</Pill>
            <Pill>{pluralize(warnings, "warning")}</Pill>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 px-4 pb-3.75 pt-3 [border-top-width:0.5px] border-border">
          <ShareButton href={twitterUrl}>Share on X</ShareButton>
          <ShareButton href={linkedinUrl}>Share on LinkedIn</ShareButton>
          <ShareButton onClick={handleCopyBadge}>Copy GitHub badge</ShareButton>
        </div>
      </div>
    </div>
  );
};
