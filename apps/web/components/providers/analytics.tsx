import { DatabuddyDevtools } from "@databuddy/devtools/react";
import { Databuddy } from "@databuddy/sdk/react";

export const Analytics = () => (
  <>
    <DatabuddyDevtools enabled={process.env.NODE_ENV !== "production"} />
    <Databuddy
      clientId={process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID}
      trackHashChanges
      trackAttributes
      trackOutgoingLinks
      trackInteractions
      trackWebVitals
      trackErrors
      disabled={process.env.NODE_ENV === "development"}
    />
  </>
);
