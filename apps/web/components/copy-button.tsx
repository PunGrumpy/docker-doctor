"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";

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
      console.error("Failed to copy text:", error);
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
        "relative size-9 flex items-center justify-center rounded-md shadow-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.96] transition-[transform,colors,border-color] duration-150 ease-out",
        // Hit area extended to 40x40px
        "after:absolute after:-inset-0.5 after:content-['']",
        className
      )}
      aria-label="Copy to clipboard"
      {...props}
    >
      <Copy
        className={cn(
          "size-4 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          copied
            ? "opacity-0 scale-[0.25] blur-xs"
            : "opacity-100 scale-100 blur-0"
        )}
      />
      <Check
        className={cn(
          "absolute inset-0 size-4 m-auto transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          copied
            ? "opacity-100 scale-100 blur-0"
            : "opacity-0 scale-[0.25] blur-xs"
        )}
      />
    </button>
  );
};
