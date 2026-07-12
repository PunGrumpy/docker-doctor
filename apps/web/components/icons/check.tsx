import type { SVGProps } from "react";

export const Check = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 24a12 12 0 1 0 0-24 12 12 0 0 0 0 24m6.21-14.598a1.5 1.5 0 1 0-1.92-2.304c-3.129 2.607-5.54 5.87-6.807 7.764L7.81 13.189a1.5 1.5 0 0 0-2.12 2.121l1.89 1.89.028.029c.165.167.35.35.519.495.18.15.484.386.912.495a2.22 2.22 0 0 0 1.554-.156c.402-.198.657-.498.801-.681.138-.177.283-.399.42-.603l.021-.036c1.158-1.755 3.447-4.9 6.375-7.341"
      clipRule="evenodd"
    />
  </svg>
);
