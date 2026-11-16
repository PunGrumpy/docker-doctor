"use client";

import dynamic from "next/dynamic";

// Next replaces NODE_ENV at build time and drops the dynamic import in the
// production branch, so the devtools code never reaches the production bundle.
const DatabuddyDevtools =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(
        async () => {
          const { DatabuddyDevtools: Devtools } =
            await import("@databuddy/devtools/react");

          return Devtools;
        },
        { ssr: false }
      );

export const Devtools = () => {
  if (!DatabuddyDevtools) {
    return null;
  }

  return <DatabuddyDevtools />;
};
