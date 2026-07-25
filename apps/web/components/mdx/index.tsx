import type { MDXComponents } from "mdx/types";

import {
  Anchor,
  Card,
  Cards,
  Code,
  Heading2,
  Heading3,
  ListItem,
  OrderedList,
  Paragraph,
  Pre,
  Table,
  TableCell,
  TableHeaderCell,
  UnorderedList,
} from "./elements";

export const getMDXComponents = (
  components?: MDXComponents
): MDXComponents => ({
  Card,
  Cards,
  a: Anchor,
  code: Code,
  h2: Heading2,
  h3: Heading3,
  li: ListItem,
  ol: OrderedList,
  p: Paragraph,
  pre: Pre,
  table: Table,
  td: TableCell,
  th: TableHeaderCell,
  ul: UnorderedList,
  ...components,
});

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
