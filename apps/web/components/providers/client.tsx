"use client";

import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const DesignSystemProvider = ({ children }: PropsWithChildren) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
  >
    <TooltipProvider delay={0}>
      {children}
      <Toaster />
    </TooltipProvider>
  </ThemeProvider>
);
