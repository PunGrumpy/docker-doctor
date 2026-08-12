"use client";

import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { Ban } from "@/components/icons/ban";
import { CircleCheck } from "@/components/icons/circle-check";
import { CircleInfo } from "@/components/icons/circle-info";
import { Loader } from "@/components/icons/loader";
import { TriangleWarning } from "@/components/icons/triangle-warning";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-5 shrink-0" />,
        info: <CircleInfo className="size-5 shrink-0" />,
        warning: <TriangleWarning className="size-5 shrink-0" />,
        error: <Ban className="size-5 shrink-0" />,
        loading: <Loader className="size-5 shrink-0 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-xl)",
        } as CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          toast: "shadow-custom!",
          title: "text-sm font-medium",
          description: "text-muted-foreground text-sm",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
