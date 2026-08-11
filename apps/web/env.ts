import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_DATABUDDY_CLIENT_ID: z.string(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DATABUDDY_CLIENT_ID:
      process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
