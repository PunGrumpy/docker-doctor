export const HIDE_CURSOR = "\u001B[?25l";
export const SHOW_CURSOR = "\u001B[?25h";
export const CLEAR_TO_LINE_END = "\u001B[K";

export const cursorUp = (lines: number): string => `\u001B[${lines}A`;
