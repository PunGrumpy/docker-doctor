import { Section } from "@/components/section";

export const Hero = () => (
  <Section className="gap-8 pt-16 pb-16 lg:pt-24 lg:pb-24">
    <div className="group relative inline-block">
      <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight sm:text-5xl">
        Infrastructure
      </h1>
    </div>
    <div className="text-muted-foreground text-center">
      Scoring your infrastructure health with rules
    </div>
  </Section>
);
