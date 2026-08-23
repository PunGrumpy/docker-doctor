import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CopyButton } from "@/components/copy-button";
import { Pill } from "@/components/pill";
import { cn } from "@/lib/utils";

const getNodeText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }
  if (isValidElement(node)) {
    const { children } = node.props as { children?: ReactNode };
    return getNodeText(children);
  }
  return "";
};

const SNIPPET_LABEL_MAX_LENGTH = 64;

// Databuddy already attaches `path` and `title` to every event, so the only
// thing it can't infer is *which* block on the page was copied — the first
// line identifies it (`npx @docker-doctor/cli@latest`, `FROM node:22`, …).
const getSnippetLabel = (code: string): string => {
  const [firstLine = ""] = code.split("\n");
  const trimmed = firstLine.trim();
  return trimmed.length > SNIPPET_LABEL_MAX_LENGTH
    ? `${trimmed.slice(0, SNIPPET_LABEL_MAX_LENGTH)}…`
    : trimmed;
};

export const Heading2 = ({
  className,
  children,
  ...props
}: ComponentProps<"h2">) => (
  <h2
    className={cn(
      // scroll-mt matches the sticky header + mobile TOC stack below xl.
      "mt-12 mb-4 scroll-mt-28 font-serif text-2xl font-normal tracking-tight xl:scroll-mt-24",
      className
    )}
    {...props}
  >
    {children}
  </h2>
);

export const Heading3 = ({
  className,
  children,
  ...props
}: ComponentProps<"h3">) => (
  <h3
    className={cn(
      "mt-8 mb-3 scroll-mt-28 font-serif text-xl font-normal tracking-tight xl:scroll-mt-24",
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

export const Paragraph = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    className={cn("text-foreground/90 my-4 leading-7", className)}
    {...props}
  />
);

// Lists reset the marketing `ul, ol` base style (globals.css) to body prose.
export const UnorderedList = ({
  className,
  ...props
}: ComponentProps<"ul">) => (
  <ul
    className={cn(
      "text-foreground/90 my-4 block list-disc ps-6 text-base leading-7 [&_&]:my-1",
      className
    )}
    {...props}
  />
);

export const OrderedList = ({ className, ...props }: ComponentProps<"ol">) => (
  <ol
    className={cn(
      "text-foreground/90 my-4 block list-decimal ps-6 text-base leading-7 [&_&]:my-1",
      className
    )}
    {...props}
  />
);

export const ListItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li className={cn("my-1.5", className)} {...props} />
);

export const Anchor = ({
  href,
  className,
  children,
  ...props
}: ComponentProps<"a">) => {
  if (href?.startsWith("/")) {
    return (
      <Link
        className={cn(
          "text-primary underline underline-offset-4 hover:opacity-80",
          className
        )}
        href={href}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      className={cn(
        "text-primary underline underline-offset-4 hover:opacity-80",
        className
      )}
      href={href}
      {...props}
    >
      {children}
    </a>
  );
};

export const Code = ({ className, ...props }: ComponentProps<"code">) => (
  <code
    className={cn(
      "bg-muted text-foreground rounded-md border px-1.5 py-0.5 font-mono text-[0.8125em]",
      // Reset the inline-code chip when this `code` is the child of a `pre`
      // (a fenced/highlighted block) so shiki's own token colors show
      // through untouched.
      "in-[pre]:font-inherit in-[pre]:rounded-none in-[pre]:border-0 in-[pre]:bg-transparent in-[pre]:p-0 in-[pre]:text-inherit",
      className
    )}
    {...props}
  />
);

export const Pre = ({
  children,
  className,
  title,
  // fumadocs forwards fence meta as props; `icon` is raw SVG markup that
  // must not land on the DOM element.
  icon: _icon,
  ...props
}: ComponentProps<"pre"> & { readonly icon?: string }) => {
  const code = getNodeText(children);

  return (
    <div className="group bg-background shadow-border relative my-6 overflow-hidden rounded-xl">
      {title ? (
        <div className="text-muted-foreground border-b border-dashed px-4 py-2 font-mono text-xs">
          {title}
        </div>
      ) : null}
      <pre
        className={cn("overflow-x-auto p-4 font-mono text-sm", className)}
        {...props}
      >
        {children}
      </pre>
      <CopyButton
        aria-label="Copy code"
        className="absolute top-2 right-2 rounded-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        data-snippet={getSnippetLabel(code)}
        data-track="docs_code_copied"
        value={code}
      />
    </div>
  );
};

export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div className="shadow-border my-6 overflow-x-auto rounded-xl">
    <table className={cn("w-full text-sm", className)} {...props} />
  </div>
);

export const TableHeaderCell = ({
  className,
  ...props
}: ComponentProps<"th">) => (
  <th
    className={cn(
      "bg-muted/50 border-b px-4 py-2 text-start font-medium",
      className
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td
    className={cn(
      "border-border/60 border-b px-4 py-2 in-[tr:last-child]:border-b-0",
      className
    )}
    {...props}
  />
);

interface CardProps {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly href?: string;
  readonly children?: ReactNode;
}

export const Card = ({ icon, title, href, children }: CardProps) => {
  const content = (
    <>
      {icon ? (
        <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg [&>svg]:size-4">
          {icon}
        </div>
      ) : null}
      <p className="mt-3 font-medium">{title}</p>
      {children ? (
        // `children` is the card body from MDX, already wrapped in our
        // custom `p` (Paragraph) component — use a `div` here so we don't
        // nest a `<p>` inside another `<p>`.
        <div className="text-muted-foreground mt-1 text-sm [&>p]:my-0">
          {children}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        className={cn(
          "bg-card shadow-custom rounded-xl p-4",
          "hover:bg-muted/30 block transition-colors"
        )}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return <div className="bg-card shadow-custom rounded-xl p-4">{content}</div>;
};

export const Cards = ({ children }: { readonly children: ReactNode }) => (
  <div className="my-6 grid gap-3 sm:grid-cols-2">{children}</div>
);

const SEVERITY_HUE = {
  error: "red",
  info: "blue",
  warning: "amber",
} as const;

export const SeverityPill = ({ severity }: { readonly severity: string }) => (
  <Pill
    contrast="low"
    size="sm"
    variant={SEVERITY_HUE[severity as keyof typeof SEVERITY_HUE] ?? "gray"}
  >
    {severity}
  </Pill>
);
