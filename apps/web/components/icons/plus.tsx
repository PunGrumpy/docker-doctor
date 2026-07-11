import type { SVGProps } from "react";

export const Plus = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13 6C13 5.448 12.552 5 12 5C11.448 5 11 5.448 11 6V11H6C5.448 11 5 11.448 5 12C5 12.552 5.448 13 6 13H11V18C11 18.552 11.448 19 12 19C12.552 19 13 18.552 13 18V13H18C18.552 13 19 12.552 19 12C19 11.448 18.552 11 18 11H13V6Z"
      fill="currentColor"
    />
  </svg>
);
