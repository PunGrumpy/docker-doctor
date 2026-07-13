export { cn } from "cnfast";

export const pluralize = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;
