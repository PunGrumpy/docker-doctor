"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

// Public client token for the PostHog project — safe to ship in the bundle.
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  "phc_DjoT7pYmeZ5rhi65kHPRVnQUAweAqkfnJsMeVyQG6EvZ";

export const PostHog = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      defaults: "2025-05-24",
      ui_host: "https://us.posthog.com",
    });
  }, []);

  return null;
};
