import {
  AlertTriangle,
  Check,
  GitCommitHorizontal,
  Hammer,
  ScanSearch,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/badge";
import { CopyButton } from "@/components/copy-button";
import { Cube } from "@/components/icons/cube";
import { Section } from "@/components/section";

const KIT_COMMAND =
  "sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude";

const TrafficLights = ({ dotClass }: { readonly dotClass: string }) => (
  <div aria-hidden="true" className="flex items-start gap-2">
    <div
      className={`shrink-0 rounded-full bg-[oklch(71.3%_0.171_26)] dark:bg-[#323232] ${dotClass}`}
    />
    <div
      className={`shrink-0 rounded-full bg-[oklch(82.5%_0.159_80.9)] dark:bg-[#323232] ${dotClass}`}
    />
    <div
      className={`shrink-0 rounded-full bg-[oklch(88.4%_0_0)] dark:bg-[#323232] ${dotClass}`}
    />
  </div>
);

interface AgentStepProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly actions?: readonly { text: string; warn?: boolean }[];
}

const AgentStep = ({ icon, label, actions }: AgentStepProps) => (
  <div className="bg-background shadow-custom flex flex-col gap-1.5 rounded-lg px-2.5 py-2">
    <div className="text-foreground flex items-center gap-1.5">
      <span aria-hidden="true" className="[&_svg]:size-3 [&_svg]:min-w-3">
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
    {actions && actions.length > 0 && (
      <ul className="flex list-none flex-col gap-1">
        {actions.map((action) => (
          <li
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs"
            key={action.text}
          >
            {action.warn ? (
              <AlertTriangle
                aria-hidden="true"
                className="size-3 min-w-3 text-yellow-600 dark:text-yellow-400"
              />
            ) : (
              <Check
                aria-hidden="true"
                className="size-3 min-w-3 text-emerald-500"
              />
            )}
            <span className="min-w-0 truncate">{action.text}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const Sandboxes = () => (
  <Section className="flex w-full flex-col items-center pt-8 pb-16 lg:pb-32">
    <h2 className="text-foreground flex flex-col items-center justify-center text-3xl font-normal tracking-tight sm:text-5xl">
      <span className="bg-muted relative top-[-0.08em] ml-1 inline-flex items-center gap-3 rounded-lg px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <Cube aria-hidden="true" className="size-8" />
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

    <div className="relative mt-8 mb-4 w-full max-w-185 sm:mb-12">
      <section
        aria-label="Sandbox demo"
        className="bg-card shadow-border w-full overflow-hidden rounded-3xl"
      >
        <header className="relative flex h-[45px] w-full shrink-0 items-center justify-center border-b border-b-[#EBEBEB] select-none dark:border-b-[#1f1f1f]">
          <h3 className="text-muted-foreground text-center text-[17px] leading-[145%] font-medium">
            <span className="hidden sm:inline">Docker Sandbox — </span>microVM
          </h3>
          <div className="absolute top-[15px] left-[18px]">
            <TrafficLights dotClass="size-[17px]" />
          </div>
        </header>

        <div className="space-y-3 p-6 font-mono text-sm leading-relaxed sm:flex sm:min-h-[460px] sm:flex-col sm:text-[13px]">
          <div className="text-foreground flex items-center gap-2">
            <span className="font-bold text-emerald-500 select-none">$</span>
            <span className="min-w-0 truncate">{KIT_COMMAND}</span>
          </div>
          <div className="text-muted-foreground flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
              <span>microVM started — private kernel and Docker daemon</span>
            </div>
            <div className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
              <span>@docker-doctor/cli installed (pinned)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
              <span>agent skill → ~/.claude/skills/docker-doctor</span>
            </div>
            <div className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
              <span>agent memory: lint Docker changes before committing</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:mt-auto sm:justify-end sm:pl-60 sm:text-right">
            <span className="text-foreground font-semibold">
              <span aria-hidden="true">✅ </span>Committed clean:
            </span>
            <span className="text-muted-foreground">
              Dockerfile scored 100/100 before it left the sandbox
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Agent conversation"
        className="bg-card shadow-border mt-3 w-full overflow-hidden rounded-3xl sm:absolute sm:-bottom-8 sm:-left-2 sm:mt-0 sm:max-w-56 lg:-left-6"
      >
        <header className="relative flex h-8 w-full shrink-0 items-center justify-center border-b border-b-[#EBEBEB] select-none dark:border-b-[#1f1f1f]">
          <h3 className="text-muted-foreground text-center text-xs font-medium">
            Agent
          </h3>
          <div className="absolute top-[11px] left-[11px]">
            <TrafficLights dotClass="size-2.5" />
          </div>
        </header>
        <div className="flex flex-col gap-2 p-3">
          <div className="bg-muted text-foreground ml-6 rounded-lg px-2.5 py-1.5 text-xs">
            Containerize this app
          </div>
          <AgentStep
            actions={[{ text: "Dockerfile" }]}
            icon={<Hammer aria-hidden="true" />}
            label="Write Dockerfile"
          />
          <AgentStep
            actions={[
              { text: "3 issues found", warn: true },
              { text: "pin-image-version → fixed" },
              { text: "no-root-user → fixed" },
            ]}
            icon={<ScanSearch aria-hidden="true" />}
            label="Run docker-doctor"
          />
          <AgentStep
            actions={[{ text: "0 issues · score 100/100" }]}
            icon={<GitCommitHorizontal aria-hidden="true" />}
            label="Commit"
          />
        </div>
      </section>
    </div>

    <div className="bg-background shadow-border flex w-full max-w-185 items-center gap-3 rounded-xl py-1.5 pr-1.5 pl-4">
      <span className="text-muted-foreground/60 font-mono select-none">$</span>
      <pre className="no-scrollbar flex-1 overflow-x-auto whitespace-nowrap select-all">
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
        Read the Docker Sandboxes guide <span aria-hidden="true">→</span>
      </Link>
    </p>
  </Section>
);
