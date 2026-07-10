# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.

---

# Architecture

## Package Layout

```tree
.
├── packages/
│   ├── core/                          PRIVATE  the diagnostic engine (runs JIT, exports src/index.ts)
│   │   └── src/
│   │       ├── types/                 PRIVATE shared cross-package TS types (DockerfileInstruction, Diagnostic, ProjectInfo, …)
│   │       ├── project-info/          project discovery (discoverProject)
│   │       ├── config/                configuration loader (loadConfig)
│   │       ├── parsers/               Dockerfile and Compose parsers
│   │       ├── rules/                 rule definitions (Security, Performance, Best Practices, etc.)
│   │       ├── runners/               rule runner orchestration
│   │       └── schemas/               schema validators for config and JSON reports
│   └── docker-doctor/                 PUBLISHED  CLI wrapper (compiles via tsdown)
└── apps/
    └── web/                           PRIVATE  Next.js web application
```

## Effect v4 Conventions

Built on `effect@4.0.0-beta.70`. See `tmp/effect/.patterns/effect.md` (cloned reference) for canonical examples.

### Imports

- ALWAYS: `import * as Schema from "effect/Schema"`, `import * as Effect from "effect/Effect"`, `import * as Cause from "effect/Cause"`, etc. — one module per import line.
- NEVER: `import { Schema, Effect } from "effect"` — the umbrella import inflates the type-resolution graph and contradicts what every other Effect codebase does.

### Error dispatch / recovery — v4 idioms

- **`Effect.catchReasons(errorTag, cases, orElse?)`** — the v4-canonical way to dispatch on a `Schema.TaggedErrorClass` reason union. Each entry catches one reason `_tag`; the optional `orElse` handles unmatched reasons. NEVER write manual `if (cause.reason instanceof X)` ladders inside a `catch` block — the Effect pipeline gives you exhaustive, type-safe narrowing for free. See `inspect.ts → restoreLegacyThrow` and `api/diagnose.ts` for the canonical shape.
- **`Effect.catchTag(tag, handler)`** — for a single tagged error (e.g. `Effect.catchTag("PlatformError", ...)` in `services/git.ts` to fold the `ChildProcess` platform error into a `ReactDoctorError`).
- **`Effect.catch`** (renamed from v3 `Effect.catchAll`) — for catch-all.
- **`Effect.die(error)`** — promote a recovered value into a defect that `runPromise` re-throws unchanged. Used in `catchReasons` handlers when the programmatic contract still wants the legacy `Error` class on the throw.
- **NEVER** `try/catch` inside `Effect.gen` (v4 hard rule). Wrap the sync throw in `Effect.try({ try, catch })` and recover via `Effect.orElseSucceed` / `Effect.catch` instead. See `render-summary.ts → printSummary` for the canonical shape.

### Generator hygiene

- **`return yield* Effect.fail(...)`** — terminal effects (Effect.fail, Effect.interrupt, Effect.die) must be `return yield*` so TypeScript sees the unreachable-code property. Bare `yield*` of a terminal lets unreachable code accumulate after it. See `services/git.ts` `diffSelection` for examples.
- **`Effect.gen({ self: this }, function* () { ... })`** — v4 changed the `self`-bound form. The plain `Effect.gen(function* () { ... })` form is unchanged; only class-method generators bound to `this` need the options object.
- **`Effect.fnUntraced(function* () { ... })`** — prefer over a function whose body is `Effect.gen` when the function is called many times per operation (hot path). Cuts tracing overhead. Not currently used in this codebase — Git invocations and inspect-pipeline calls run once per scan, not in a hot loop.

## Reference reading

- `tmp/effect/.patterns/effect.md` — canonical Effect v4 idioms (cloned for reference, gitignored)
