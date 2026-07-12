import type { SVGProps } from "react";

export const Copy = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M18.384 2.27A3.75 3.75 0 0 1 21.75 6v6l-.02.384a3.75 3.75 0 0 1-3.346 3.347L18 15.75h-2.25V18A3.75 3.75 0 0 1 12 21.75H6A3.75 3.75 0 0 1 2.25 18v-6A3.75 3.75 0 0 1 6 8.25h2.25V6A3.75 3.75 0 0 1 12 2.25h6zM12 4.5A1.5 1.5 0 0 0 10.5 6v2.25H12A3.75 3.75 0 0 1 15.75 12v1.5H18a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 18 4.5z"
    />
  </svg>
);
