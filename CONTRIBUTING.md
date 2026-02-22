# Contributing to TokenSmith

Thank you for taking the time to contribute. This document covers everything you need to get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Commands](#development-commands)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Getting Started

**Requirements:** Node.js 18+ and npm.

```bash
git clone https://github.com/aqib-io/tokensmith.git
cd tokensmith
npm install
```

That's it — no build step needed before running tests. The repo uses [Biome](https://biomejs.dev/) for linting and formatting, and [Vitest](https://vitest.dev/) for tests.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile to `dist/` (ESM + CJS + type declarations) |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Run `tsc --noEmit` (no output files) |
| `npm run lint` | Check `src/` with Biome |
| `npm run lint:fix` | Auto-fix Biome lint errors |
| `npm run format` | Auto-format `src/` with Biome |

**Before submitting a PR**, make sure all four gates pass:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

The `prepublishOnly` script runs these automatically on publish.

## Code Style

TokenSmith is written in strict TypeScript. The following rules apply to all code in `src/`:

- **No `any`** — use proper types, generics, or `unknown` with narrowing.
- **No inline comments** — write self-documenting code. If a block genuinely needs explanation, prefer a named helper function over a comment.
- **Strict TypeScript** — `tsconfig.json` enables `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `isolatedDeclarations`. All type errors must be resolved without casting.
- **Biome formatting** — single quotes, 2-space indent, LF line endings, trailing commas where valid in ES5. Run `npm run lint:fix` or `npm run format` to auto-apply.
- **No dependencies** — TokenSmith ships zero runtime dependencies. Do not add any. Browser APIs and TypeScript's standard library are fine.
- **SSR safety** — any access to `document`, `window`, `localStorage`, or `BroadcastChannel` must be guarded against `undefined` (server environments lack these globals).

## Pull Request Process

**Branch naming:**

```
feat/<short-description>     # new feature
fix/<short-description>      # bug fix
docs/<short-description>     # documentation only
refactor/<short-description> # code change with no behavior change
test/<short-description>     # tests only
```

**Commit messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Use the format `type: description` with the subject line under 72 characters. Reference the issue number if applicable.

| Type | When to use |
|------|-------------|
| `feat` | New feature or behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no behavior change |
| `test` | Tests only |
| `chore` | Tooling, deps, release scripts |

```
feat: add offline-aware retry delay to RefreshManager (#42)
fix: round cookie Max-Age for tokens expiring in < 1 second
docs: update README with fromCookieHeader SSR example
```

**What to include in a PR:**

1. A clear description of what changed and why.
2. Tests for any new behavior — TokenSmith maintains 100% test coverage of the public API.
3. Updates to the relevant section of `README.md` if you changed public-facing behavior.
4. All four CI gates passing locally (`typecheck`, `lint`, `test`, `build`).

PRs that change the public API (`TokenManager` interface, exported types, or error classes) must include a README update and a note in the PR description explaining the change.

## Reporting Bugs

Please [open an issue](https://github.com/aqib-io/tokensmith/issues) with the following:

- **TokenSmith version** (`npm list tokensmith`)
- **Environment** — browser name + version, or Node.js version for SSR issues
- **Minimal reproduction** — the smallest code that triggers the bug
- **Expected behavior** vs. **actual behavior**

For security vulnerabilities, do **not** open a public issue. Follow the process in [SECURITY.md](./SECURITY.md).

## Feature Requests

Before opening a feature request, check the [existing issues](https://github.com/aqib-io/tokensmith/issues) to see if it has already been proposed.

When opening a new request, describe:

1. The problem you are trying to solve (not just the solution you have in mind).
2. How you currently work around it.
3. Whether it could be solved with the existing `StorageAdapter` interface or a custom `refresh.handler`.

TokenSmith intentionally ships zero dependencies and a minimal API surface. Features that require new dependencies, break the existing interface, or belong to a specific framework adapter (Vue, Svelte, etc.) are unlikely to be accepted in the core package — but may be a good fit as a separate community package.
