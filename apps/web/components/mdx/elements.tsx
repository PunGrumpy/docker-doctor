import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CopyButton } from "@/components/copy-button";
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

export const Heading2 = ({
  className,
  children,
  ...props
}: ComponentProps<"h2">) => (
  <h2
    className={cn(
      "mt-12 mb-4 scroll-mt-24 font-serif font-normal text-2xl tracking-tight",
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
      "mt-8 mb-3 scroll-mt-24 font-serif font-normal text-xl tracking-tight",
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

export const Paragraph = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    className={cn("my-4 text-foreground/90 leading-7", className)}
    {...props}
  />
);

export const UnorderedList = ({
  className,
  ...props
}: ComponentProps<"ul">) => (
  <ul className={cn("my-4 ml-6 list-disc", className)} {...props} />
);

export const OrderedList = ({ className, ...props }: ComponentProps<"ol">) => (
  <ol className={cn("my-4 ml-6 list-decimal", className)} {...props} />
);

export const ListItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li className={cn("my-1.5", className)} {...props} />
);

const linkClassName =
  "text-primary underline underline-offset-4 hover:opacity-80";

export const Anchor = ({
  href,
  className,
  children,
  ...props
}: ComponentProps<"a">) => {
  if (href?.startsWith("/")) {
    return (
      <Link className={cn(linkClassName, className)} href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a className={cn(linkClassName, className)} href={href} {...props}>
      {children}
    </a>
  );
};

export const Code = ({ className, ...props }: ComponentProps<"code">) => (
  <code
    className={cn(
      "rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground",
      // Reset the inline-code chip when this `code` is the child of a `pre`
      // (a fenced/highlighted block) so shiki's own token colors show
      // through untouched.
      "in-[pre]:rounded-none in-[pre]:border-0 in-[pre]:bg-transparent in-[pre]:p-0 in-[pre]:font-inherit in-[pre]:text-inherit",
      className
    )}
    {...props}
  />
);

export const Pre = ({
  children,
  className,
  ...props
}: ComponentProps<"pre">) => {
  const code = getNodeText(children);

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl bg-background shadow-border">
      <pre
        className={cn("overflow-x-auto p-4 font-mono text-sm", className)}
        {...props}
      >
        {children}
      </pre>
      <CopyButton
        aria-label="Copy code"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        value={code}
      />
    </div>
  );
};

export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div className="my-6 overflow-x-auto rounded-xl border">
    <table className={cn("w-full text-sm", className)} {...props} />
  </div>
);

export const TableHeaderCell = ({
  className,
  ...props
}: ComponentProps<"th">) => (
  <th
    className={cn(
      "border-b bg-muted/50 px-4 py-2 text-left font-medium",
      className
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td
    className={cn("border-b border-border/60 px-4 py-2", className)}
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
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-4">
          {icon}
        </div>
      ) : null}
      <p className="mt-3 font-medium">{title}</p>
      {children ? (
        // `children` is the card body from MDX, already wrapped in our
        // custom `p` (Paragraph) component — use a `div` here so we don't
        // nest a `<p>` inside another `<p>`.
        <div className="mt-1 text-muted-foreground text-sm [&>p]:my-0">
          {children}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        className={cn(
          "rounded-xl bg-card p-4 shadow-custom",
          "block transition-colors hover:bg-muted/30"
        )}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-xl bg-card p-4 shadow-custom">{content}</div>;
};

export const Cards = ({ children }: { readonly children: ReactNode }) => (
  <div className="my-6 grid gap-3 sm:grid-cols-2">{children}</div>
);
