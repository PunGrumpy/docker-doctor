// True for a string with at least one character, which is what a truthiness
// test on a string that may be missing checked.
export const hasText = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";
