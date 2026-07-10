import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Section = ({
  children,
  className,
  ...props
}: ComponentProps<"section">) => (
  <section
    className={cn(
      "relative flex flex-col items-center gap-2 w-full",
      className
    )}
    {...props}
  >
    {children}
  </section>
);
