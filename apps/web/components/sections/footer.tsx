import packageJson from "@docker-doctor/docker-doctor/package.json";

import { Section } from "@/components/section";

export const Footer = () => (
  <Section className="pt-8 pb-16">
    <footer className="flex w-full items-center justify-between">
      <div className="select-none rounded-full bg-muted text-muted-foreground px-3 py-1.5 font-medium text-sm">
        v
        <span className="tabular-nums text-foreground">
          {packageJson.version}
        </span>
      </div>
      <div className="text-muted-foreground text-sm">
        Created by&nbsp;
        <a
          href="https://www.pungrumpy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 transition-colors hover:text-foreground"
        >
          Noppakorn Kaewsalabnil
        </a>
      </div>
    </footer>
  </Section>
);
