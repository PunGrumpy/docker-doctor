export { cn } from "cn";

export const pluralize = (count: number, word: string) => {
  const noun = count === 1 ? word : `${word}s`;

  return `${count} ${noun}`;
};
