import type { SVGProps } from "react";

export const Logo = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 64 64"
    {...props}
  >
    <path
      fill="#2b7fff"
      d="M60.313 0h-5.214L51.41 18.74 45.645 0H37.49l-5.76 18.74L22.424 0H9.3L0 18.74v26.52L9.3 64h13.13l9.3-18.74L37.49 64h8.155l5.76-18.74L55.094 64h5.214l3.687-18.74V18.74z"
    />
  </svg>
);
