"use client";

import { trackError } from "@databuddy/sdk/react";
import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { Check } from "@/components/icons/check";
import { Copy } from "@/components/icons/copy";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<ComponentProps<"button">, "onClick"> {
  readonly value: string;
}

export const CopyButton = ({ value, className, ...props }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch (error) {
      trackError(
        error instanceof Error ? error.message : "clipboard write failed",
        { error_type: "clipboard_copy" }
      );
    }
  }, [value]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "shadow-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-primary focus-visible:ring-offset-background relative flex size-9 cursor-pointer items-center justify-center rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-2",
        "transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.96]",
        // Hit area extended to 40x40px
        "after:absolute after:-inset-0.5 after:content-['']",
        className
      )}
      aria-label="Copy to clipboard"
      {...props}
    >
      <Copy
        className={cn(
          "size-4 transition-all duration-200 ease-[var(--ease-out)]",
          copied
            ? "scale-[0.6] opacity-0 blur-xs"
            : "blur-0 scale-100 opacity-100"
        )}
      />
      <Check
        className={cn(
          "absolute inset-0 m-auto size-4 transition-all duration-200 ease-[var(--ease-out)]",
          copied
            ? "blur-0 scale-100 opacity-100"
            : "scale-[0.6] opacity-0 blur-xs"
        )}
      />
    </button>
  );
};
