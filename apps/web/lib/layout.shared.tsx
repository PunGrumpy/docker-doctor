import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Logo } from "@/components/logo";

import { appName, gitConfig } from "./shared";

export const baseOptions = (): BaseLayoutProps => ({
  githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  links: [
    { active: "nested-url", text: "Docs", url: "/docs" },
    { text: "Changelog", url: "/changelog" },
  ],
  nav: {
    title: (
      <>
        <Logo className="size-4" />
        {appName}
      </>
    ),
    url: "/",
  },
});
