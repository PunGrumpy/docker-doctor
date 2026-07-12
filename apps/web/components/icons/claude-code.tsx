import type { SVGProps } from "react";

export const ClaudeCode = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 217 144"
    {...props}
  >
    <path
      fill="#f76038"
      d="M216.06 57.69h-27.88V0H27.88v57.69H0v29.16h27.44v27.88h13.84v29.16h14.29v-29.16h12.95v28.72h13.84v-28.28h51.06v28.72h14.29v-28.72h12.95v28.28h13.4v-28.28h13.85V86.85h28.11V57.69z"
    />
    <path
      d="M55.63 29.61h12.95v28.08H55.63zm92.13.22h12.95v27.86h-12.95z"
      className="fill-white dark:fill-[#151515]"
    />
  </svg>
);
