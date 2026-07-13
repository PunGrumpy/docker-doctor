import { Section } from "@/components/section";
import type { ChangelogData } from "@/lib/changelog";
import { cn } from "@/lib/utils";

interface ChangeItemProps {
  readonly change: {
    sha: string;
    title: string;
    details: string[];
  };
}

const ChangeItem = ({ change }: ChangeItemProps) => (
  <li>
    <div className="text-sm leading-relaxed text-foreground/85">
      <a
        href={`https://github.com/PunGrumpy/docker-doctor/commit/${change.sha}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "font-mono text-xs text-muted-foreground hover:text-foreground",
          "transition-colors duration-200 ease-[var(--ease-out)]",
          "active:scale-[0.96] will-change-transform inline-block",
          "py-2.5"
        )}
      >
        {change.sha}
      </a>
      <span className="mx-1.5 text-muted-foreground/40" aria-hidden="true">
        —
      </span>
      <span>{change.title}</span>
    </div>
    {change.details.length > 0 && (
      <ul className="mt-1 space-y-0.5">
        {change.details.map((detail, i) => (
          <li
            key={`${change.sha}-${i}`}
            className="text-sm text-muted-foreground/70 pl-4 relative"
          >
            <span
              className="absolute left-0 top-0 text-muted-foreground/30 select-none"
              aria-hidden="true"
            >
              –
            </span>
            {detail}
          </li>
        ))}
      </ul>
    )}
  </li>
);

interface ChangelogProps {
  readonly data: ChangelogData;
}

export const Changelog = ({ data }: ChangelogProps) => {
  const { versions } = data;

  if (versions.length === 0) {
    return (
      <Section className="pt-8 pb-16">
        <p className="text-muted-foreground text-sm">No releases yet.</p>
      </Section>
    );
  }

  return (
    <Section className="pt-8 pb-16">
      <div className="w-full max-w-2xl">
        {versions.map((version, index) => (
          <div key={version.version}>
            {index > 0 && (
              <div
                className="my-16 h-px w-full border-t border-dashed sm:my-20"
                aria-hidden="true"
              />
            )}

            <div className="flex flex-col items-center justify-center rounded-2xl bg-card/20 p-1 shadow-custom group-focus-visible:ring-2">
              <div className="relative flex size-full flex-col items-start justify-start p-4 overflow-hidden rounded-xl preview-card">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-balance font-semibold text-lg tracking-tight">
                    v<span className="tabular-nums">{version.version}</span>
                  </h2>
                  {index === 0 && (
                    <span className="select-none rounded-full bg-blue-500/10 text-blue-500 px-3 py-1 text-xs font-medium">
                      Latest
                    </span>
                  )}
                </div>

                {version.minor.length > 0 && (
                  <div className="mb-4 last:mb-0">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Minor Changes
                    </h3>
                    <ul className="space-y-2">
                      {version.minor.map((change) => (
                        <ChangeItem key={change.sha} change={change} />
                      ))}
                    </ul>
                  </div>
                )}

                {version.patch.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Patch Changes
                    </h3>
                    <ul className="space-y-2">
                      {version.patch.map((change) => (
                        <ChangeItem key={change.sha} change={change} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};
