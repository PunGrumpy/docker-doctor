"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import { env } from "@/lib/env";

export const PostHog = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      defaults: "2025-05-24",
      ui_host: "https://us.posthog.com",
    });
  }, []);

  return null;
};
