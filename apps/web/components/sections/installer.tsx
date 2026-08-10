import { CopyButton } from "@/components/copy-button";
import { GitHub } from "@/components/icons/github";
import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

export const Installer = () => (
  <Section className="flex w-full flex-col items-center gap-3 pt-8 pb-8 sm:flex-row">
    <div className="bg-background shadow-border flex w-full flex-1 items-center gap-3 rounded-xl py-1.5 pr-1.5 pl-4">
      <span className="text-muted-foreground/60 font-mono select-none">$</span>
      <pre className="flex-1 truncate select-all">
        <code className="text-muted-foreground shimmer font-mono">
          npx @docker-doctor/cli@latest
        </code>
      </pre>
      <CopyButton
        value="npx @docker-doctor/cli@latest"
        aria-label="Copy installation command"
        data-track="install_command_copied"
      />
    </div>
    <a
      href="https://github.com/PunGrumpy/docker-doctor"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 sm:w-auto",
        "has-[>svg:first-child:not(:last-child)]:pl-3 has-[>svg:last-child:not(:first-child)]:pr-3 has-[>svg:only-child]:px-3",
        "bg-linear-to-b from-blue-400 to-blue-500 font-medium text-white shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]"
      )}
      aria-label="View on GitHub"
    >
      <GitHub className="size-5" />
      <span className="content select-none">View on GitHub</span>
    </a>
  </Section>
);
