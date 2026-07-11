# Contributing to Docker Doctor

Thank you for your interest in contributing! Docker Doctor is an open-source project, and contributions are welcome! Whether you want to improve the documentation, add new diagnostic rules, or contribute code, here's how you can get involved.

## Source Code

Docker Doctor's source code is hosted on GitHub at [PunGrumpy/docker-doctor](https://github.com/PunGrumpy/docker-doctor). The repository contains all rule definitions, parsers, CLI implementation, and documentation.

## Monorepo Structure

Docker Doctor is a monorepo managed with [Bun](https://bun.sh) workspaces and [Turbo](https://turbo.build/repo):

- `packages/core` - The diagnostic engine (private)
  - `src/types/` - Shared TypeScript types
  - `src/project-info/` - Project discovery
  - `src/config/` - Configuration loader
  - `src/parsers/` - Dockerfile and Compose parsers
  - `src/rules/` - Rule definitions (Security, Performance, Best Practices, etc.)
  - `src/runners/` - Rule runner orchestration
  - `src/schemas/` - Schema validators
- `packages/docker-doctor` - Published CLI wrapper (compiles via `tsdown`)
- `apps/web` - Next.js web application (private)

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/docker-doctor.git`
3. Install dependencies: `bun install`
4. Create a new branch for your feature or bug fix: `git checkout -b fix/description`
5. Make your changes
6. Run tests: `bun run test`
7. Build packages: `bun run build`
8. Type-check: `bun run typecheck`
9. Lint and format: `bun run check`
10. Commit your changes with clear, descriptive commit messages
11. Push to your fork
12. Submit a Pull Request

### Testing Your Changes Locally

To test the CLI locally:

1. Build the CLI: `bun run build --filter @docker-doctor/cli`
2. Run directly: `bun run --packages/docker-doctor docker-doctor <path-to-test-project>`
3. Or link it locally: `cd packages/docker-doctor && bun link --global`
4. In your test project: `bun link --global @docker-doctor/cli`
5. Run `npx @docker-doctor/cli` to test your changes

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

## Testing Rule Changes

If you modify rules in `packages/core/src/rules/`:

1. Test on various Dockerfile and Compose samples to verify correctness
2. Run the test suite: `bun run test`
3. Check for false positives and false negatives
4. Consider backward compatibility
5. Update the rule's documentation if behavior changes
6. Run `bun run check` on the codebase itself

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
- See [AGENTS.md](/AGENTS.md) for the full coding standards, including Effect v4 conventions

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
