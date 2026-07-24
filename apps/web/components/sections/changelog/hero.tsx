import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

export const Hero = () => (
  <Section className="pt-32 pb-16 lg:pb-24 lg:pt-24 gap-8">
    <div className="group relative inline-block">
      <h1 className="text-balance font-serif text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
        Changelog
      </h1>
    </div>
    <div className="text-center text-muted-foreground">
      Release notes for the Docker Doctor CLI, read directly from the{" "}
      <a
        href="https://github.com/PunGrumpy/docker-doctor/releases"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-block text-foreground underline underline-offset-3 decoration-muted-foreground",
          "transition-[color,text-decoration-color] duration-200 ease-[var(--ease-out)]",
          "hover:decoration-foreground active:scale-[0.96]",
          "py-2"
        )}
      >
        GitHub releases
      </a>
      .
    </div>
  </Section>
);
