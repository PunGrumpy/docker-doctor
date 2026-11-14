"use client";

import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export const DesignSystemProvider = ({ children }: PropsWithChildren) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
  >
    {children}
  </ThemeProvider>
);
