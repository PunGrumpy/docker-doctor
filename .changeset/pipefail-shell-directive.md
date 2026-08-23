---
"@docker-doctor/cli": patch
---

Make `use-pipefail` understand the `SHELL` directive. The rule's own docs prescribe `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` as the fix, but applying it never cleared the warning because only the single `RUN` line was inspected. The rule now tracks the active shell per stage and skips the diagnostic while the shell enables pipefail; a stage reached `FROM <previous stage>` inherits it, a fresh base image or `scratch` resets it, matching BuildKit. The bare-substring match is replaced with a check for an actual `set -o pipefail` command, which also closes the opposite error: `RUN echo "pipefail" | tee log` no longer counts as configuring pipefail.
