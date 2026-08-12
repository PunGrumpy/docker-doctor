import { Section } from "@/components/section";

export const Hero = () => (
  <Section className="gap-8 pt-24 pb-8 sm:pt-32 sm:pb-16 lg:pb-24">
    <div className="relative inline-block">
      <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight sm:text-5xl">
        Infrastructure
      </h1>
    </div>
    <p className="text-muted-foreground text-center">
      Scoring your infrastructure health with rules
    </p>
  </Section>
);
