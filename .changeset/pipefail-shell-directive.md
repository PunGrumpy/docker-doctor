---
"@docker-doctor/cli": patch
---

Fix `use-pipefail` so its verdict reflects how Docker actually runs a `RUN`.

- **`SHELL` is honoured.** The rule's own docs prescribe `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` as the fix, but applying it never cleared the warning, because only the single `RUN` line was inspected. The active shell is now tracked per stage: a stage reached `FROM <previous stage>` inherits it, while a fresh base image or `scratch` resets it, matching BuildKit.
- **Exec-form `RUN` is judged on its own argv.** `RUN ["/bin/bash", "-o", "pipefail", "-c", "…"]` no longer warns. Conversely, a `SHELL` directive no longer suppresses the warning for an exec-form `RUN` that execs a different shell — Docker runs that argv directly, so the `SHELL` prefix never applies. **This surfaces new warnings on Dockerfiles that previously passed.**
- **Interior comments no longer flip the verdict.** The check reads the instruction's args, which have comment lines stripped, rather than the raw text. A `# TODO: use set -o pipefail` comment no longer silences a real finding, and a `# avoid curl | sh` comment no longer invents one.
- **Pipefail detection requires the option adjacent to its flag.** The previous bare-substring match exempted any line merely containing the word. Lines such as `set -o errexit && echo pipefail | tee log` and `ssh -o StrictHostKeyChecking=no h | grep pipefail` now warn. The new pattern is also linear, replacing one that backtracked pathologically on long `RUN` lines.

Known limitation: quoting is invisible to the check, so `RUN echo "set -o pipefail" >> .bashrc && cat x | grep y` still reads as configuring the option. Tracked as a `test.todo` alongside the existing quoted-pipes case.
