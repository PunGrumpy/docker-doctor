import { DatabuddyDevtools } from "@databuddy/devtools/react";
import { Databuddy } from "@databuddy/sdk/react";

import { env } from "@/lib/env";

import { PostHog } from "./posthog";

export const Analytics = () => (
  <>
    <PostHog />
    {env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID && (
      <>
        <DatabuddyDevtools enabled={process.env.NODE_ENV !== "production"} />
        <Databuddy
          clientId={env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID}
          disabled={process.env.NODE_ENV === "development"}
          trackAttributes
          trackErrors
          trackHashChanges
          trackInteractions
          trackOutgoingLinks
          trackWebVitals
        />
      </>
    )}
  </>
);
