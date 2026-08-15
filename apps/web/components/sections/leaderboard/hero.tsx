import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

interface HeroProps {
  readonly doctorVersion: string;
  readonly generatedAt: string;
  readonly repoCount: number;
}

export const Hero = ({ doctorVersion, generatedAt, repoCount }: HeroProps) => (
  <Section className="gap-8 pt-32 pb-16 lg:pt-24 lg:pb-24">
    <div className="group relative inline-block">
      <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight text-balance sm:text-5xl">
        Leaderboard
      </h1>
    </div>
    <div className="text-muted-foreground text-center">
      {repoCount} open-source repos scanned with{" "}
      <code className="text-foreground font-mono text-sm">
        @docker-doctor/cli v{doctorVersion}
      </code>{" "}
      on {generatedAt.slice(0, 10)}. See how scoring works and add your project
      in the{" "}
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
