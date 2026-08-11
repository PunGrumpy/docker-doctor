import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Section = ({
  children,
  className,
  ...props
}: ComponentProps<"section">) => (
  <section
    className={cn(
      "relative flex w-full flex-col items-center gap-2",
      className
    )}
    {...props}
  >
    {children}
  </section>
);
