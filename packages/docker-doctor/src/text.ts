export const hasText = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";
