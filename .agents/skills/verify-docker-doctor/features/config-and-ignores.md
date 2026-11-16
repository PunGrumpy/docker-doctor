# Config and ignores

A project tunes docker-doctor with a `docker-doctor.config.yaml` or `docker-doctor.config.ts` file and with inline `docker-doctor-ignore` comments. `--no-config` turns both off, for a repository the user did not write.

## Sub-features

- `config-ignore-files` skips files matched by `ignore.files`.
- `config-path` loads a config file named with `-c` or `--config`.
- `config-off` ignores config files and inline comments with `--no-config`.
- `inline-ignore` suppresses one finding, or one rule for the file, with a comment.
- `config-unknown-key` warns about a mistyped key and names it.

## How to get to it (user POV)

- Add `docker-doctor.config.yaml` at the scanned directory's root.
- Run `docker-doctor -c <path> <dir>`.
- Run `docker-doctor --no-config <dir>`.
- Write `# docker-doctor-ignore <rule> -- <reason>` above a Dockerfile line.

## Driving it with control-docker-doctor

Preconditions:

- `$C fixture --run "$RUN" with-ignore-config ignore-dockerfile with-unknown-config-keys` ran.

- **Ignored files.** Run `$C run --run "$RUN" -- --score with-ignore-config`. Exit code `0` and stdout is `99`, because the config skips `vendored/**`.
- **Config off.** Run `$C run --run "$RUN" -- --no-config --score with-ignore-config`. Exit code `1` and stdout is `87`, because the vendored Dockerfile is scanned.
- **Inline ignores.** Run `$C run --run "$RUN" -- --json ignore-dockerfile`. No diagnostic in stdout has rule `docker-doctor/no-secrets-in-env`, `docker-doctor/no-root-user` or `docker-doctor/require-labels`.
- **Inline ignores off.** Run `$C run --run "$RUN" -- --no-config --json ignore-dockerfile`. Exit code `1` and stdout has a `docker-doctor/no-secrets-in-env` diagnostic.
- **Explicit config path.** Run `$C run --run "$RUN" -- -c with-ignore-config/docker-doctor.config.yaml --score with-ignore-config`. Exit code `0` and stdout is `99`.
- **Unknown key.** Run `$C run --run "$RUN" -- with-unknown-config-keys`. stderr names `docker-doctor/no-root-users` and the config file.

## Gotchas

- A `-c` path is relative to the run's `work/`, not to the scanned directory.
- `--no-config` also turns off inline ignore comments. A test of inline ignores must run without it.
- The helper refuses a `-c` or `--config=` path outside `work/`, including one reached through a symlink.
