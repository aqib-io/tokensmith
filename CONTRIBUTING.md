# Contributing to TokenSmith

Thank you for taking the time to contribute. When it comes to open source, there are different ways you can contribute, all of which are valuable. This document covers everything you need to get started.

## Before You Start

Before working on a contribution, [open an issue](https://github.com/aqib-io/tokensmith/issues) describing what you want to build or fix. It's possible someone else is already working on something similar, or there may be a reason that feature isn't implemented yet. The maintainers will point you in the right direction.

This step is optional for small bug fixes or documentation improvements.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Commands](#development-commands)
- [Code Style](#code-style)
- [Versioning (Changesets)](#versioning-changesets)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [License](#license)

## Getting Started

**Requirements:** Node.js 18+ and npm.

1. Fork this repo on GitHub.
2. Clone your fork and install dependencies:

```bash
git clone git@github.com:{your_username}/tokensmith.git
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
| `npm run lint` | Check `src/` and `tests/` with Biome |
| `npm run lint:fix` | Auto-fix Biome lint errors in `src/` and `tests/` |
| `npm run format` | Auto-format `src/` and `tests/` with Biome |

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

## Versioning (Changesets)

TokenSmith uses [Changesets](https://github.com/changesets/changesets) to manage versioning, changelogs, and npm publishing. **You do not need to edit `package.json` version or `CHANGELOG.md` by hand.**

After making your code changes, run:

```bash
npx changeset
```

Follow the prompts:

1. **Semver bump** — `patch` for bug fixes, `minor` for new features, `major` for breaking changes.
2. **Summary** — a short description of the change (this becomes the changelog entry).

This creates a markdown file in `.changeset/`. Commit it alongside your code changes.

**What happens after your PR is merged:**

1. A GitHub Action detects the changeset and opens a "Version Packages" PR.
2. That PR bumps `package.json`, updates `CHANGELOG.md`, and deletes consumed changeset files.
3. When a maintainer merges the Version PR, the package is automatically published to npm and a GitHub Release is created.

If your PR does not change public-facing behavior (e.g. internal refactoring, tests, CI fixes), you can skip the changeset — the CI bot will remind you if one is expected.

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

## License

By contributing your code to the TokenSmith GitHub repository, you agree to license your contribution under the [MIT license](./LICENSE).
