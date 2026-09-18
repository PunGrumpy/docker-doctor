# Contributing to Docker Doctor

Thank you for your interest in contributing! Docker Doctor is an open-source project, and contributions are welcome! Whether you want to improve the documentation, add new diagnostic rules, or contribute code, here's how you can get involved.

## Source Code

Docker Doctor's source code is hosted on GitHub at [PunGrumpy/docker-doctor](https://github.com/PunGrumpy/docker-doctor). The repository contains all rule definitions, parsers, CLI implementation, and documentation.

## Monorepo Structure

Docker Doctor is a monorepo managed with [Bun](https://bun.sh) workspaces and [Turbo](https://turbo.build/repo):

- `packages/core` (private): the diagnostic engine, consumed as raw TypeScript
  - `src/types/`: shared TypeScript types
  - `src/project-info/`: project discovery
  - `src/config/`: configuration loader
  - `src/parsers/`: Dockerfile and Compose parsers
  - `src/rules/`: rule definitions (Security, Performance, Best Practices, Compose, Image Size)
  - `src/runners/`: rule orchestration and severity resolution
  - `src/schemas/`: hand-rolled config validator (`validateConfig`)
  - `src/errors/`: `ConfigError`, `ParseError`, `FileNotFoundError`
  - `src/report.ts` and `src/scoring.ts`: report assembly and scoring
- `packages/docker-doctor` (published): the `@docker-doctor/cli` package, bundled by `tsdown`
  - `src/cli.ts`: flag parsing, scan orchestration, exit codes
  - `src/agents/`: skill install, handoff payload, agent launching
  - `src/formatters/`: the terminal report
- `packages/videos` (private): Remotion release videos
- `apps/web` (private): Next.js + fumadocs documentation site
- `kits/docker-doctor` (private): Docker Sandboxes kit; `spec.yaml` is synced by `bun run kit:sync`
- `skills/`: `docker-doctor` (bundled into the npm package), `docker-author`, `improve-docker`
- `scripts/`: rule docs generator, kit spec sync, GitHub Action comment renderer
- `action.yml`: composite GitHub Action

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/docker-doctor.git`
3. Install dependencies: `bun install`
4. Set up the web app environment: if you are not working on the web app, export `SKIP_ENV_VALIDATION=1` before `bun run build` and `bun run typecheck`; otherwise copy `apps/web/.env.example` to `apps/web/.env` and fill it in
5. Create a new branch for your feature or bug fix: `git checkout -b fix/description`
6. Make your changes
7. Run tests: `bun run test`
8. Build packages: `bun run build`
9. Type-check: `bun run typecheck`
10. Lint and format: `bun run check`
11. Commit your changes with clear, descriptive commit messages
12. Push to your fork
13. Submit a Pull Request

### Testing Your Changes Locally

Run it directly against a test project — no build or link required:

```bash
bun packages/docker-doctor/src/cli.ts <path-to-test-project>
```

This works because `packages/core` declares `"main": "./src/index.ts"` (raw TS) and Bun runs TypeScript directly, so your local edits are picked up immediately.

To test the actual BUILT binary instead:

1. Build the CLI: `bun run build --filter @docker-doctor/cli`
2. Link it locally: `cd packages/docker-doctor && bun link --global`
3. In your test project: `bun link --global @docker-doctor/cli`
4. Run `docker-doctor <path-to-test-project>` (the linked bin) — do NOT run it via `npx`, which resolves the published package from the registry instead of your local build

### Editing Documentation

The documentation site lives in `apps/web/`. To work on it:

```bash
cd apps/web
bun install
bun dev
```

## Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs for the published `@docker-doctor/cli` package. When you make changes that affect users, create a changeset:

1. Run `bun run changeset` in the root directory
2. Select `@docker-doctor/cli` (use space to select, enter to confirm)
3. Choose the appropriate version bump:
   - `patch` - Bug fixes and minor changes
   - `minor` - New features that don't break existing functionality
   - `major` - Breaking changes
4. Write a clear description of your changes (this will appear in the changelog)
5. Commit the generated changeset file in `.changeset/` with your changes

**When to create a changeset:**

- Bug fixes
- New diagnostic rules
- Breaking changes to rule output or configuration
- Performance improvements
- CLI behavior changes

**When NOT to create a changeset:**

- Changes to `packages/core` or `apps/web` (internal packages)
- Test updates
- Build configuration changes
- README or contributing guide updates

## Adding or changing a rule

Work through this checklist in order:

1. Implement the rule in the matching `packages/core/src/rules/<category>.ts` and add it to that file's exported array, which `rules/index.ts` registers.
2. Add positive **and** negative cases to `packages/core/test/rules.test.ts`, so the rule fires when it should and stays silent when it should not.
3. Add the authored docs entry to `scripts/rule-page-content.ts`. Generation fails when a rule has no entry.
4. Run `bun run docs:rules` and commit the generated page under `apps/web/content/docs/reference/rules/`. The Format CI job diffs this output.
5. Add a changeset: `bun run changeset`, select `@docker-doctor/cli`, `minor` for a new rule or `patch` for a fix.
6. Run `bun run fix && bun run test && bun run typecheck`.

## Pull Request Guidelines

- Ensure your PR addresses a specific issue or adds value to the project
- Include a clear description of the changes and rationale
  - Example: "Adds a new rule to detect COPY --chown misconfigurations"
  - Example: "Fixes false positive in no-root-user when USER is set via ARG"
- Keep changes focused and atomic
- Follow existing code style and conventions
- Include tests for new rules or bug fixes
- **Add a changeset if your changes affect the published `@docker-doctor/cli`**
- Update documentation as needed
- Ensure all tests pass: `bun run test`
- Ensure type-check passes: `bun run typecheck`
- Write clear commit messages

## Working in the Monorepo

### Running Commands

From the root directory:

- `bun run test` - Run tests across all packages
- `bun run build` - Build all packages
- `bun run typecheck` - Type-check all packages
- `bun run check` - Run Ultracite linter on the codebase
- `bun run fix` - Auto-fix linting and formatting issues
- `bun run dev` - Watch mode for all packages

From a specific package (e.g., `packages/core`):

- `bun test` - Run tests for that package only
- `bun run typecheck` - Type-check that package only

### Package Dependencies

- Use `bun add <package>` to add workspace dependencies
- Use `bun add <package> --filter @docker-doctor/core` to add to the core package
- Use `bun add <package> --filter @docker-doctor/cli` to add to the CLI package

## Code Style

- Run `bun run fix` before committing to auto-format your code with Ultracite (Oxlint + Oxfmt)
- Write clear, self-documenting code
- Add comments only for complex logic that isn't obvious from the code
- Use meaningful variable and function names
- Follow TypeScript best practices — the linter will guide you
- See [AGENTS.md](/AGENTS.md) for the coding standards and repo conventions

## Reporting Issues and Discussions

### Bugs and Issues

Use the GitHub [issue tracker](https://github.com/PunGrumpy/docker-doctor/issues) to report bugs:

- Check if the issue already exists before creating a new one
- Use the bug report template
- Include the Docker Doctor version
- Provide steps to reproduce with a minimal Dockerfile or Compose example

### Feature Requests

For new rule suggestions or feature requests, use the feature request template:

- Describe the problem your feature solves
- Explain the expected behavior
- Include examples of Dockerfiles or Compose files it should handle

### Questions or Need Help?

Feel free to open a [discussion](https://github.com/PunGrumpy/docker-doctor/discussions) for questions.

## Code of Conduct

Please note that this project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

Thank you for contributing!
