import { Pill } from "@/components/pill";
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
    <div className="text-foreground/85 text-sm leading-relaxed">
      <a
        href={`https://github.com/PunGrumpy/docker-doctor/commit/${change.sha}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "text-muted-foreground hover:text-foreground font-mono text-xs",
          "transition-colors duration-200 ease-[var(--ease-out)]",
          "inline-block will-change-transform active:scale-[0.96]",
          "py-2.5"
        )}
      >
        {change.sha}
      </a>
      <span className="text-muted-foreground/40 mx-1.5" aria-hidden="true">
        —
      </span>
      <span>{change.title}</span>
    </div>
    {change.details.length > 0 && (
      <ul className="mt-1 space-y-0.5">
        {change.details.map((detail, i) => (
          <li
            key={`${change.sha}-${i}`}
            className="text-muted-foreground/70 relative pl-4 text-sm"
          >
            <span
              className="text-muted-foreground/30 absolute top-0 left-0 select-none"
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

            <div className="bg-card/20 shadow-custom flex flex-col items-center justify-center rounded-2xl p-1">
              <div className="preview-card relative flex size-full flex-col items-start justify-start overflow-hidden rounded-xl p-4">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-balance">
                    v<span className="tabular-nums">{version.version}</span>
                  </h2>
                  {index === 0 && (
                    <Pill contrast="low" size="md" variant="blue">
                      Latest
                    </Pill>
                  )}
                </div>

                {version.minor.length > 0 && (
                  <div className="mb-4 last:mb-0">
                    <h3 className="text-muted-foreground mb-2 text-sm font-medium">
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
                    <h3 className="text-muted-foreground mb-2 text-sm font-medium">
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
