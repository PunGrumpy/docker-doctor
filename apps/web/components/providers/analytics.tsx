import { Databuddy } from "@databuddy/sdk/react";

import { Devtools } from "@/components/providers/devtools";
import { env } from "@/env";

export const Analytics = () => (
  <>
    <Devtools />
    <Databuddy
      clientId={env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID}
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
