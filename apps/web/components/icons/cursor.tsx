import type { SVGProps } from "react";

export const Cursor = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" {...props}>
    <g fill="none" fillRule="evenodd">
      <path
        fill="#fff"
        d="m16.148 25.473 1.863-1.003 1.615-.839-2.568-4.816h4.332L10.011 7.407v16.015l3.316-3.221z"
      />
      <path
        fill="#000"
        d="m16.431 24 1.765-.941-2.775-5.202h3.604L11 9.814v11.188l2.53-2.442z"
      />
    </g>
  </svg>
);
