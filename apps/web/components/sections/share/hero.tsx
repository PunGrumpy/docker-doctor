import { Section } from "@/components/section";

export const Hero = () => (
  <Section className="pt-16 pb-16 lg:pb-24 lg:pt-24 gap-8">
    <div className="group relative inline-block">
      <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
        Infrastructure
      </h1>
    </div>
    <div className="text-center text-muted-foreground">
      Scoring your infrastructure health with rules
    </div>
  </Section>
);
