# Explaining and configuring rules

Explain Docker Doctor rules and edit `docker-doctor.config.*` safely. Use this when a user wants to understand a rule or change which rules run — not for fixing diagnostics (that is the main `docker-doctor` skill / `/docker-doctor`).

Triggers: "why did this rule fire", "I disagree with this rule", "turn this rule off", "stop flagging X", "too noisy", "disable the image-size rules".

## Workflow

1. Identify the rule key from the diagnostic — always the full key, e.g. `docker-doctor/no-root-user`.
2. Explain it before changing anything:

```bash
npx @docker-doctor/cli@latest rules explain docker-doctor/no-root-user
```

3. Pick the narrowest change that matches the user's intent (see decision guide).
4. **Hand-edit `docker-doctor.config.ts`** (or `.js`/`.mjs`/`.cjs`/`.json`, or the `dockerDoctor` key in `package.json`). There is no `rules disable`/`set`/`category` CLI subcommand — configuration is edited by hand.
5. Validate the change did what they wanted:

```bash
npx @docker-doctor/cli@latest . --verbose
```

## Commands

```bash
npx @docker-doctor/cli@latest rules list              # every rule + category + default severity + description
npx @docker-doctor/cli@latest rules explain <rule>    # why it matters + how to fix. FULL key required
```

> Rule references require the **full** key (`docker-doctor/no-root-user`). The bare id (`no-root-user`) is rejected. `rules list` and `rules explain` are the only `rules` subcommands — everything else is done in the config file.

## Config shape

Config lives in `docker-doctor.config.{ts,js,mjs,cjs,json}` or the `dockerDoctor` key in `package.json`. Three maps:

```ts
// docker-doctor.config.ts
export default {
  // Per-rule severity override. Severity: "error" | "warning" | "info" | "off".
  // Fully implemented (packages/core/src/runners/dockerfile-runner.ts): the
  // configured severity replaces the rule's default for every diagnostic it produces.
  rules: {
    "docker-doctor/no-root-user": "off",
    "docker-doctor/use-multi-stage": "warning",
  },
  // Per-category override. Categories: "Security" | "Performance" | "Best Practices" | "Compose" | "Image Size".
  // Only "off" currently has any effect (it disables the whole category). Any other
  // value here ("error" / "warning" / "info") is accepted by the schema but ignored —
  // there is no category-level severity cascade today.
  categories: {
    "Image Size": "off",
  },
};
```

The config schema also accepts an `ignore.files` array, but it is NOT currently implemented — nothing in the codebase reads it, so listing files there has no effect. Do not tell users it will exempt a file from scanning.

## Decision guide

Match the change to the intent — prefer the narrowest one:

- **User disagrees with one rule / it's a false positive** → set it off in `rules`: `"docker-doctor/<key>": "off"`. The rule stops running everywhere. This is the default for "I don't want this rule".
- **Rule is fine but wrong severity** → set `"docker-doctor/<key>": "warning"` (or `"error"` / `"info"`) in `rules`. This works today via the per-rule override.
- **A whole area is unwanted** (e.g. all image-size rules) → set the category off: `categories: { "Image Size": "off" }`. This is the only working `categories` value.
- **A specific file should be exempt from everything** → there is currently no way to do this; `ignore.files` is unimplemented. Say so rather than suggesting it.

How this actually combines: each rule's default severity can be overridden per-rule via `rules`. Separately, a whole category can be turned `"off"` via `categories`, which drops every diagnostic in that category regardless of per-rule settings. There is no severity cascade between `categories` and `rules` beyond that "off" check — a non-"off" `categories` value does nothing.

## Educating the user

When explaining a rule, lead with the `Description` and `Help / Fix` guidance from `rules explain`. Only after the user understands what the rule catches should you offer to disable it — many "annoying" rules (running as root, secrets in `ENV`, unpinned base images) are catching real security and reproducibility problems.
