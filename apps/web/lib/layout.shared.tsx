import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Logo } from "@/components/logo";
import { ChangelogButton, GitHubButton } from "@/components/nav-buttons";

export const baseOptions = (): BaseLayoutProps => ({
  links: [
    { children: <ChangelogButton />, secondary: true, type: "custom" },
    { children: <GitHubButton />, secondary: true, type: "custom" },
  ],
  nav: {
    title: (
      <>
        <Logo className="size-4" />
        Docker Doctor
      </>
    ),
    url: "/",
  },
});
