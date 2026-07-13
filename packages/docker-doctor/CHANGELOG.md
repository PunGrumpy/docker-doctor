# @docker-doctor/cli

## 0.2.1

### Patch Changes

- 62078a3: Update terminal formatter to output a score sharing URL pointing to the web app dashboard with score, warnings, and errors parameters.
- 49fb8ba: Update terminal score box URL from GitHub repo to Vercel web app.

## 0.2.0

### Minor Changes

- ccfca12: Replace `readline/promises` text input with fully interactive keyboard-driven prompts.

  - `askConfirm`: vertical Yes/No layout with arrow keys, vim keys (h/j/k/l), and y/n shortcuts
  - `askSelect`: vertical option list with up/down / j/k navigation
  - Hidden cursor during prompts; restored on exit, Ctrl+C, SIGINT, and SIGTERM
  - Falls back gracefully to default values in non-TTY (CI/pipe) environments

### Patch Changes

- c47c581: Reduce score animation duration from 2 s to 300 ms (20 frames × 15 ms). Guard animation behind `isTTY`, `CI`, `NO_ANIMATION`, `TERM=dumb`, and `NODE_ENV=test` checks to ensure a clean experience in non-interactive environments.
- 0a04d98: Fix workspace discovery to correctly track and validate `.dockerignore` files, resolving false-positive warnings in the `useDockerignore` performance rule.
- a744994: Fix `no-secrets-in-env` rule to support space-separated `ENV KEY VALUE` format, ensuring hardcoded credentials in this format are correctly detected by the linter.
- 60b743d: Fix `FROM` and `COPY`/`ADD` instruction parsing in rules to correctly skip option flags (e.g. `--platform`, `--chown`), preventing false-positive diagnostics or layer ordering check failures.

## 0.1.0

### Minor Changes

- c11718b: Initial release
