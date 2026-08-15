import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

interface HeroProps {
  readonly repoCount: number;
}

export const Hero = ({ repoCount }: HeroProps) => (
  <Section className="gap-8 pt-32 pb-16 lg:pt-24 lg:pb-24">
    <div className="group relative inline-block">
      <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight text-balance sm:text-5xl">
        Leaderboard
      </h1>
    </div>
    <div className="text-muted-foreground text-center">
      Docker quality scores for {repoCount} popular open-source projects,
      refreshed monthly from the{" "}
      <a
        href="https://github.com/PunGrumpy/docker-doctor-benchmarks"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "text-foreground decoration-muted-foreground inline-block underline underline-offset-3",
          "transition-[color,text-decoration-color] duration-200 ease-[var(--ease-out)]",
          "hover:decoration-foreground active:scale-[0.96]",
          "py-2"
        )}
      >
        benchmarks repo
      </a>
      .
    </div>
  </Section>
);
