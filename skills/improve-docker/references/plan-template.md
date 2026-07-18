# Plan template

One file per opportunity under `plans/`, named `<priority>-<short-slug>.md` (e.g. `high-run-as-non-root.md`). Fill every section. The plan must be self-contained — an executing agent should need only this file and the repo.

```markdown
# <Title — the outcome, not the rule name>

- **Priority:** HIGH | MEDIUM | LOW (impact ÷ effort — not the scanner severity)
- **Category:** Security | Image Size | Performance | Best Practices | Compose
- **File(s):** path/to/Dockerfile:12, docker-compose.yaml:8
- **Rule(s):** docker-doctor/no-root-user (omit if judgment-only, no rule)

## Problem

What's wrong and why it matters in production — concrete consequence (breakout risk, cache miss, image bloat, no auto-heal). Quote the offending lines.

## Fix

The exact change. Show before → after diff-style snippets. Pull the recipe from the diagnostic `help` or `npx @docker-doctor/cli@latest rules explain <full-rule-key>`. If it interacts with other findings (e.g. multi-stage refactor touches image-size + performance), say so.

## Verify

- [ ] `npx @docker-doctor/cli@latest . --verbose` no longer reports `<rule>` at this location
- [ ] `npx @docker-doctor/cli@latest . --score` did not drop (ideally rose)
- [ ] Image still builds: `docker build .` (and `docker compose config` if Compose changed)

## Risks / notes

Anything that could break at runtime (non-root file permissions, healthcheck endpoint must exist, distroless has no shell). Empty if none.
```

## Rules for good plans

- **Self-contained:** no "see the audit" references — inline what the executor needs.
- **One concern per plan:** if a change spans categories, pick the primary and cross-link the others.
- **Verifiable:** every plan ends in a mechanical check (`--score` / re-scan / `docker build`), never "looks good".
- **Honest priority:** a one-line security fix on a public image beats a big refactor that shaves megabytes off an internal one.
