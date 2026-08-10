import { Badge } from "@/components/badge";
import { Section } from "@/components/section";

export const Hero = () => (
  <Section className="gap-4 pt-32 pb-16 lg:pb-24">
    <div className="group relative inline-block">
      <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight sm:text-5xl">
        Docker Doctor
      </h1>
      <span
        aria-hidden="true"
        className="absolute -inset-x-1 inset-y-0 border border-blue-500 bg-blue-500/5 transition-colors duration-200 ease-[var(--ease-out)] group-hover:bg-blue-500/10"
      />
      <span
        aria-hidden="true"
        className="bg-background absolute top-[-2.5px] left-[-6.5px] size-1.5 border border-blue-500"
      />
      <span
        aria-hidden="true"
        className="bg-background absolute top-[-2.5px] right-[-6.5px] size-1.5 border border-blue-500"
      />
      <span
        aria-hidden="true"
        className="bg-background absolute bottom-[-2.5px] left-[-6.5px] size-1.5 border border-blue-500"
      />
      <span
        aria-hidden="true"
        className="bg-background absolute right-[-6.5px] bottom-[-2.5px] size-1.5 border border-blue-500"
      />
      <Badge
        aria-hidden="true"
        className="bottom-full left-1/2 mb-7 -translate-x-1/2"
      >
        <span className="bg-card text-muted-foreground shadow-custom block rounded-lg px-1.5 py-1 font-mono text-xs tracking-normal whitespace-nowrap select-none">
          diagnostics
        </span>
        <span className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="h-3 border-l border-dashed" />
          <span className="bg-border block shrink-0 rounded-full p-0.5">
            <span className="bg-background block size-[5px] shrink-0 rounded-full" />
          </span>
        </span>
      </Badge>
    </div>
    <div className="text-muted-foreground text-center">
      Diagnostics your infrastructure with&nbsp;
      <span className="relative inline-block">
        Docker and Docker Compose
        <span
          aria-hidden="true"
          className="absolute top-[8px] -right-0.5 -left-0.5 h-[0.5px] bg-cyan-300"
        />
        <span
          aria-hidden="true"
          className="absolute -right-0.5 bottom-[6px] -left-0.5 h-[0.5px] bg-cyan-300"
        />
        <Badge
          aria-hidden="true"
          className="-right-1/4 bottom-full mb-7 -translate-x-1/2"
        >
          <span className="bg-card text-muted-foreground shadow-custom block rounded-lg px-1.5 py-1 font-mono text-xs tracking-normal whitespace-nowrap select-none">
            opinionated
          </span>
          <span className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center">
            <span className="h-3 border-l border-dashed" />
            <span className="bg-border block shrink-0 rounded-full p-0.5">
              <span className="bg-background block size-[5px] shrink-0 rounded-full" />
            </span>
          </span>
        </Badge>
      </span>
    </div>
  </Section>
);
