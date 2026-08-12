import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const SOLID = "default" as const;
const SUBTLE = "low" as const;

type PillHue =
  | "gray"
  | "blue"
  | "purple"
  | "amber"
  | "red"
  | "pink"
  | "green"
  | "teal";

const subtle = (hue: PillHue, klass: string) => ({
  class: klass,
  contrast: SUBTLE,
  variant: hue,
});
const solid = (hue: PillHue, klass: string) => ({
  class: klass,
  contrast: SOLID,
  variant: hue,
});

const pill = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-normal whitespace-nowrap tabular-nums",
    "**:data-[slot=icon]:block **:data-[slot=icon]:shrink-0",
  ],
  {
    compoundVariants: [
      solid("gray", "bg-neutral-900 text-white dark:bg-neutral-500"),
      solid("blue", "bg-blue-700 text-white"),
      solid(
        "purple",
        "bg-purple-900 text-white dark:bg-purple-500 dark:text-black"
      ),
      solid("amber", "bg-amber-500 text-black"),
      solid("red", "bg-red-900 text-white dark:bg-red-800"),
      solid("pink", "bg-pink-900 text-white dark:bg-pink-600 dark:text-black"),
      solid(
        "green",
        "bg-green-900 text-white dark:bg-green-600 dark:text-black"
      ),
      solid("teal", "bg-teal-900 text-white dark:bg-teal-600 dark:text-black"),
      subtle(
        "gray",
        "text-(--badge-gray-1000) before:bg-[oklch(from_var(--badge-gray-200)_0.94_c_h)] dark:before:bg-[oklch(from_var(--badge-gray-200)_0.27_c_h)]"
      ),
      subtle(
        "blue",
        "text-(--badge-blue-900) before:bg-[oklch(from_var(--badge-blue-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-blue-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "purple",
        "text-(--badge-purple-900) before:bg-[oklch(from_var(--badge-purple-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-purple-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "amber",
        "text-(--badge-amber-900) before:bg-[oklch(from_var(--badge-amber-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-amber-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "red",
        "text-(--badge-red-900) before:bg-[oklch(from_var(--badge-red-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-red-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "pink",
        "text-(--badge-pink-900) before:bg-[oklch(from_var(--badge-pink-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-pink-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "green",
        "text-(--badge-green-900) before:bg-[oklch(from_var(--badge-green-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-green-200)_0.27_calc(c*1.3)_h)]"
      ),
      subtle(
        "teal",
        "text-(--badge-teal-900) before:bg-[oklch(from_var(--badge-teal-200)_0.94_calc(c*1.3)_h)] dark:before:bg-[oklch(from_var(--badge-teal-200)_0.27_calc(c*1.3)_h)]"
      ),
    ],
    defaultVariants: {
      contrast: SOLID,
      size: "lg",
      variant: "muted",
    },
    variants: {
      contrast: {
        default: "",
        low: "relative bg-transparent before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:mix-blend-multiply before:content-[''] dark:before:mix-blend-screen",
      },
      size: {
        lg: "h-8 gap-1.5 px-3 text-sm **:data-[slot=icon]:size-4 **:data-[slot=icon]:data-[glyph=circular]:-ms-1",
        md: "h-6 gap-1.25 px-3 text-[12px]/[24px] has-[[data-glyph=circular]]:pr-2.5 **:data-[slot=icon]:size-3.5 **:data-[slot=icon]:data-[glyph=circular]:-ms-1.75",
        sm: "h-5 gap-1 px-2 text-[11px]/[20px] **:data-[slot=icon]:size-3 **:data-[slot=icon]:data-[glyph=circular]:-ms-1",
      },
      variant: {
        amber: "",
        blue: "",
        gray: "",
        green: "",
        inverted: "bg-foreground text-background",
        muted: "bg-muted",
        pink: "",
        purple: "",
        red: "",
        teal: "",
      },
    },
  }
);

interface PillProps extends ComponentProps<"span">, VariantProps<typeof pill> {}

export const Pill = ({
  className,
  contrast,
  size,
  variant,
  children,
  ...props
}: PillProps) => (
  <span className={cn(pill({ contrast, size, variant }), className)} {...props}>
    <span className="relative inline-flex min-w-0 items-center gap-[inherit]">
      {children}
    </span>
  </span>
);
