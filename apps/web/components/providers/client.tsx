"use client";

import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

import { Toaster } from "@/components/ui/sonner";

export const DesignSystemProvider = ({ children }: PropsWithChildren) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
  >
    {children}
    <Toaster />
  </ThemeProvider>
);
