import { Badge } from "@/components/badge";
import { Section } from "@/components/section";

export const Hero = () => (
  <Section className="pt-16 pb-16 lg:pb-24 lg:pt-24 gap-8">
    <div className="group relative inline-block">
      <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
        Docker Doctor
      </h1>
      <span
        aria-hidden="true"
        className="absolute -inset-x-1 inset-y-0 border border-blue-500 bg-blue-500/5 transition-colors duration-200 ease-[var(--ease-out)] group-hover:bg-blue-500/10"
      />
      <span
        aria-hidden="true"
        className="absolute top-[-2.5px] left-[-6.5px] size-1.5 border border-blue-500 bg-background"
      />
      <span
        aria-hidden="true"
        className="absolute top-[-2.5px] right-[-6.5px] size-1.5 border border-blue-500 bg-background"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[-2.5px] left-[-6.5px] size-1.5 border border-blue-500 bg-background"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[-2.5px] right-[-6.5px] size-1.5 border border-blue-500 bg-background"
      />
      <Badge
        aria-hidden="true"
        className="bottom-full left-1/2 mb-7 -translate-x-1/2"
      >
        <span className="block px-1.5 py-1 font-mono text-xs select-none whitespace-nowrap rounded-lg bg-card text-muted-foreground tracking-normal shadow-custom">
          diagnostics
        </span>
        <span className="absolute flex items-center top-full left-1/2 -translate-x-1/2 flex-col">
          <span className="border-dashed will-change-transform h-3 border-l" />
          <span className="block shrink-0 rounded-full bg-border p-0.5 will-change-transform">
            <span className="block size-[5px] shrink-0 rounded-full bg-background" />
          </span>
        </span>
      </Badge>
    </div>
    <div className="text-center text-muted-foreground">
      Diagnostics your infrastructure with&nbsp;
      <span className="relative inline-block">
        Docker and Docker Compose
        <span
          aria-hidden="true"
          className="absolute top-[8px] -right-0.5 -left-0.5 h-[0.5px] bg-cyan-300"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-[6px] -right-0.5 -left-0.5 h-[0.5px] bg-cyan-300"
        />
        <Badge
          aria-hidden="true"
          className="bottom-full -right-1/4 mb-7 -translate-x-1/2"
        >
          <span className="block px-1.5 py-1 font-mono text-xs select-none whitespace-nowrap rounded-lg bg-card text-muted-foreground tracking-normal shadow-custom">
            opinionated
          </span>
          <span className="absolute flex items-center top-full left-1/2 -translate-x-1/2 flex-col">
            <span className="border-dashed will-change-transform h-3 border-l" />
            <span className="block shrink-0 rounded-full bg-border p-0.5 will-change-transform">
              <span className="block size-[5px] shrink-0 rounded-full bg-background" />
            </span>
          </span>
        </Badge>
      </span>
    </div>
  </Section>
);
