import packageJson from "@docker-doctor/docker-doctor/package.json";

import { Pill } from "@/components/pill";
import { Section } from "@/components/section";

export const Footer = () => (
  <Section className="pt-8 pb-16">
    <footer className="flex w-full items-center justify-between">
      <Pill className="text-muted-foreground gap-0! select-none">
        v<span className="text-foreground">{packageJson.version}</span>
      </Pill>
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
