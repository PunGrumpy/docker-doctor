import packageJson from "@docker-doctor/docker-doctor/package.json";

import { Section } from "@/components/section";

export const Footer = () => (
  <Section className="pt-8 pb-16">
    <footer className="flex w-full items-center justify-between">
      <div className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-sm font-medium select-none">
        v
        <span className="text-foreground tabular-nums">
          {packageJson.version}
        </span>
      </div>
      <div className="text-muted-foreground text-sm">
        Created by&nbsp;
        <a
          href="https://www.pungrumpy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground py-2.5 transition-colors"
        >
          Noppakorn Kaewsalabnil
        </a>
      </div>
    </footer>
  </Section>
);
