import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Badge = ({
  children,
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    className={cn("pointer-events-none absolute hidden sm:block", className)}
    {...props}
  >
    {children}
  </span>
);
