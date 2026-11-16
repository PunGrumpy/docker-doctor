# Install the agent skill

`install` copies the bundled `docker-doctor` skill into a project's skill directories, so a coding agent learns the `/docker-doctor` triage workflow. `--agent` picks the agents. `--global` installs into the user's home instead.

## Sub-features

- `install-project` writes the skill into the current project for one agent.
- `install-global` writes into the user's home skills directory. The helper refuses it.

## How to get to it (user POV)

- Run `docker-doctor install` in a project and pick agents interactively.
- Run `docker-doctor install --agent claude-code` to skip the prompt.

## Driving it with control-docker-doctor

Preconditions:

- `$C doctor --run "$RUN"` exits 0.

- **Project install.** Run `$C run --run "$RUN" -- install --agent claude-code`. Exit code `0`, and stdout has `Claude Code →` followed by the run's `work/.claude/skills/docker-doctor` path.
- **Files written.** List `work/.claude/skills/docker-doctor`. It has `SKILL.md` and a `references` directory.
- **Global refused.** Run `$C run --run "$RUN" -- install --global --agent claude-code`. The helper prints `control-docker-doctor: refused:` and docker-doctor never runs.

## Gotchas

- `install` without `--agent` asks which agents to use only at a terminal. Under the helper it never prompts, so always pass `--agent`.
- The run's `HOME` is a throwaway directory. Agent detection that reads the home directory sees an empty one.
- `down` deletes `work/`, including the installed skill. The evidence file keeps the output.
