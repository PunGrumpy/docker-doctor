# Rules reference

`rules list` prints every rule with its category, default severity and description. `rules explain <rule>` prints one rule with its fix guidance.

## Sub-features

- `rules-list` lists every rule.
- `rules-explain` explains one rule by its full ID.
- `rules-explain-missing` reports a rule ID that does not exist.

## How to get to it (user POV)

- Run `docker-doctor rules list`.
- Run `docker-doctor rules explain docker-doctor/<rule>`.

## Driving it with control-docker-doctor

Preconditions:

- `$C doctor --run "$RUN"` exits 0. No fixture is needed.

- **List.** Run `$C run --run "$RUN" -- rules list`. Exit code `0`. stdout starts with `Available Rules:` and has one `- docker-doctor/` line per rule. Compare the count with `allRules` in `packages/core/src` when a change adds or removes a rule.
- **Explain.** Run `$C run --run "$RUN" -- rules explain docker-doctor/no-root-user`. Exit code `0`, and stdout has `Category:         Security` and `Default Severity: warning`.
- **Missing rule.** Run `$C run --run "$RUN" -- rules explain nope`. Exit code `1` and the output says `Rule 'nope' not found.`

## Gotchas

- `rules` rejects scan flags such as `--json`. Don't add them to a rules command.
- The rule count also appears in the READMEs and docs. `bun run check:rule-count` checks those, not this command.
