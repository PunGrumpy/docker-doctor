import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Badge } from "@/components/badge";
import { SearchFolder } from "@/components/icons/search-folder";
import { Section } from "@/components/section";

export const Architecture = () => (
  <Section className="pt-8 pb-16 lg:pb-32">
    <h2 className="text-foreground flex flex-col items-center justify-center text-3xl font-normal tracking-tight sm:text-5xl">
      <span className="bg-muted relative top-[-0.08em] ml-1 inline-flex items-center gap-2 rounded-lg px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <SearchFolder aria-hidden="true" className="size-8" />
        every scan
      </span>
      <Badge
        aria-hidden="true"
        className="-top-7 right-1/4 mb-7 -translate-x-1/4"
      >
        <span className="bg-card text-muted-foreground shadow-custom block rounded-lg px-1.5 py-1 font-mono text-xs tracking-normal whitespace-nowrap select-none">
          the engine
        </span>
        <span className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="h-3 border-l border-dashed" />
          <span className="bg-border block shrink-0 rounded-full p-0.5">
            <span className="bg-background block size-[5px] shrink-0 rounded-full" />
          </span>
        </span>
      </Badge>
    </h2>

    <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-sm text-balance">
      The engine discovers the Dockerfiles and Compose files in your project,
      runs every rule over them, and collapses the result into one health score
      — warnings inform you, errors fail the build.
    </p>

    <div className="mt-8 w-full">
      <ArchitectureDiagram />
    </div>
  </Section>
);
