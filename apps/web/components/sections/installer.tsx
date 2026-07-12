import { CopyButton } from "@/components/copy-button";
import { GitHub } from "@/components/icons/github";
import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

export const Installer = () => (
  <Section className="pt-8 pb-8 flex flex-col sm:flex-row items-center gap-3 w-full">
    <div className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-xl bg-background shadow-border flex-1 w-full">
      <span className="font-mono text-muted-foreground/60 select-none">$</span>
      <code className="font-mono text-foreground select-all flex-1 truncate">
        npx @docker-doctor/cli@latest
      </code>
      <CopyButton
        value="npx @docker-doctor/cli@latest"
        aria-label="Copy installation command"
      />
    </div>
    <a
      href="https://github.com/PunGrumpy/docker-doctor"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center justify-center gap-2 h-12 w-full sm:w-auto px-4 rounded-xl",
        "font-medium text-white",
        "bg-linear-to-b from-blue-400 to-blue-500 shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]",
        "active:scale-[0.97] hover:brightness-110 transition-[transform,filter] duration-150 ease-out"
      )}
      aria-label="View on GitHub"
    >
      <GitHub className="size-4" />
      <span className="content select-none">View on GitHub</span>
    </a>
  </Section>
);
