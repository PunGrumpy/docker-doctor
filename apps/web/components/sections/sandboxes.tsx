import { Container } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/badge";
import { CopyButton } from "@/components/copy-button";
import { Section } from "@/components/section";

const KIT_COMMAND =
  "sbx run --kit docker.io/pungrumpy/docker-doctor-kit claude";

export const Sandboxes = () => (
  <Section className="flex w-full flex-col items-center pt-8 pb-16">
    <h2 className="text-foreground flex flex-col items-center justify-center text-3xl font-normal tracking-tight sm:text-5xl">
      <span className="bg-muted relative top-[-0.08em] ml-1 inline-flex items-center gap-3 rounded-lg px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <Container
          aria-hidden="true"
          className="text-muted-foreground size-8"
        />
        every sandbox
      </span>
      <Badge
        aria-hidden="true"
        className="-top-7 left-1/4 mb-7 -translate-x-1/4"
      >
        <span className="bg-card text-muted-foreground shadow-custom block rounded-lg px-1.5 py-1 font-mono text-xs tracking-normal whitespace-nowrap select-none">
          the kit
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
      <a
        className="underline underline-offset-2"
        href="https://www.docker.com/products/docker-sandboxes/"
        rel="noopener noreferrer"
        target="_blank"
      >
        Docker Sandboxes
      </a>{" "}
      run coding agents unattended in isolated microVMs. The Docker Doctor kit
      rides along — preinstalled in every sandbox, so the agent lints its own
      Dockerfile and Compose changes before committing them.
    </p>

    <div className="bg-background shadow-border mt-8 flex w-full max-w-185 items-center gap-3 rounded-xl py-1.5 pr-1.5 pl-4">
      <span className="text-muted-foreground/60 font-mono select-none">$</span>
      <pre className="flex-1 truncate select-all">
        <code className="text-muted-foreground font-mono">{KIT_COMMAND}</code>
      </pre>
      <CopyButton
        aria-label="Copy sandbox kit command"
        data-track="sandbox_kit_command_copied"
        value={KIT_COMMAND}
      />
    </div>

    <p className="text-muted-foreground mt-4 text-center text-sm">
      <Link
        className="underline underline-offset-2"
        data-track="sandbox_guide_clicked"
        href="/docs/guides/docker-sandboxes"
      >
        Read the Docker Sandboxes guide →
      </Link>
    </p>
  </Section>
);
