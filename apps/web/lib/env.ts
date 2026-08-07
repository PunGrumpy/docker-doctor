import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_DATABUDDY_CLIENT_ID: z.string().min(1).optional(),
    // Public client token — safe in the bundle; override per environment.
    NEXT_PUBLIC_POSTHOG_KEY: z
      .string()
      .startsWith("phc_")
      .default("phc_DjoT7pYmeZ5rhi65kHPRVnQUAweAqkfnJsMeVyQG6EvZ"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_DATABUDDY_CLIENT_ID:
      process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
});
