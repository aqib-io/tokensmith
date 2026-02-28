# Release Guide

This document covers the complete release workflow for TokenSmith — from initial setup to ongoing automated releases.

## Table of Contents

- [Overview](#overview)
- [Initial Setup (One-Time)](#initial-setup-one-time)
- [Automated Release Workflow](#automated-release-workflow)
- [Manual Release (Escape Hatch)](#manual-release-escape-hatch)
- [Version Bump Rules](#version-bump-rules)
- [Branch Protection](#branch-protection)
- [Troubleshooting](#troubleshooting)

---

## Overview

TokenSmith uses [Changesets](https://github.com/changesets/changesets) for version management and GitHub Actions for CI/CD. The workflow is fully automated after initial setup.

**Key principle:** You never edit `package.json` version or `CHANGELOG.md` by hand. Changesets handles both.

```
Code change → npx changeset → PR → merge
                                      ↓
                          "Version Packages" PR (auto-created)
                                      ↓
                              Maintainer merges
                                      ↓
                          npm publish + GitHub Release (auto)
```

---

## Initial Setup (One-Time)

Complete these steps in order before the automated workflow can take over.

### Phase 1: Tag and publish v0.1.0

The first release must be done manually since no changeset exists for it.

```bash
# 1. Switch to main and tag the current library code
git checkout main
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0

# 2. Add NPM_TOKEN secret on GitHub
#    → Go to https://www.npmjs.com → Access Tokens → Generate New Token
#    → Choose "Granular Access Token" (Read-Write, scoped to tokensmith)
#    → Go to GitHub repo → Settings → Secrets and variables → Actions
#    → Add secret: Name = NPM_TOKEN, Value = <your token>

# 3. Publish to npm
npm publish --provenance --access public

# 4. Create the GitHub Release
gh release create v0.1.0 --title "v0.1.0" --notes-file CHANGELOG.md
```

### Phase 2: Merge CI/release infrastructure

```bash
# 5. Switch to the infrastructure branch and push
git checkout chore/release-workflow
git push -u origin chore/release-workflow

# 6. Open a PR to main
gh pr create --title "chore: add CI and release workflow" --body "Adds Changesets, CI pipeline, and automated release workflow."

# 7. Wait for CI to pass, then merge the PR
```

### Phase 3: Lock down main

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - Require a pull request before merging
   - Require status checks to pass before merging → add `ci` as required
4. Save changes

### Phase 4: Optional extras

- Install [changeset-bot](https://github.com/apps/changeset-bot) from the GitHub Marketplace — auto-comments on PRs reminding contributors to add a changeset if they forgot one.

---

## Automated Release Workflow

After initial setup, this is the day-to-day workflow.

### For contributors

```bash
# 1. Create a feature branch
git checkout -b feat/my-feature

# 2. Make code changes
# ...

# 3. Create a changeset
npx changeset
# → Select semver bump type (patch / minor / major)
# → Write a short summary of the change

# 4. Commit everything (code + changeset file)
git add .
git commit -m "feat: add my feature"

# 5. Open a PR
git push -u origin feat/my-feature
gh pr create
```

### For maintainers (you)

```
PR arrives
   ↓
Review code + changeset file (check bump type is correct)
   ↓
CI passes → Merge PR
   ↓
Release workflow detects changesets on main
   ↓
Auto-creates "Version Packages" PR
  • Bumps version in package.json
  • Updates CHANGELOG.md
  • Deletes consumed .changeset/*.md files
   ↓
Review the Version PR (verify version number looks right)
   ↓
Merge → Triggers automatic:
  • npm publish (with provenance)
  • git tag (v1.2.3)
  • GitHub Release (with changelog)
```

### Batching releases

You do not have to merge the Version PR immediately. If you land 5 PRs with changesets, they accumulate. The Version PR updates itself after each merge. When you finally merge it, all changes ship as one release.

---

## Manual Release (Escape Hatch)

If you ever need to release without the automated workflow:

```bash
# 1. Bump version and update changelog
npx changeset version

# 2. Review the changes
git diff

# 3. Commit
git add .
git commit -m "chore: version packages"

# 4. Publish
npm publish --provenance --access public

# 5. Tag and push
git tag -a v<version> -m "v<version>"
git push origin main --follow-tags

# 6. Create GitHub Release
gh release create v<version> --generate-notes
```

---

## Version Bump Rules

| Bump | When to use | Example |
|------|-------------|---------|
| `patch` | Bug fixes, docs, internal refactors, test changes | `0.1.0 → 0.1.1` |
| `minor` | New features, non-breaking additions to the public API | `0.1.0 → 0.2.0` |
| `major` | Breaking changes to `TokenManager` interface, exported types, error classes, or default behavior | `0.1.0 → 1.0.0` |

**When in doubt, choose `patch`.** The maintainer can always edit the changeset file in the PR before merging.

### Multiple changesets in one release

If one PR adds a `patch` changeset and another adds a `minor` changeset, the highest bump wins. The release will be a `minor` bump.

---

## Branch Protection

Recommended settings for the `main` branch (Settings → Branches):

| Setting | Value | Notes |
|---------|-------|-------|
| Require pull request before merging | Yes | No direct pushes to main |
| Required approvals | 0 (solo) or 1+ (team) | Adjust as your team grows |
| Require status checks to pass | Yes | Blocks merge if CI fails |
| Required status checks | `ci` | The CI workflow job name |
| Include administrators | Optional | If yes, even you must use PRs |

---

## Troubleshooting

### Release workflow didn't create a Version PR

- Check that the merged PR contained a `.changeset/*.md` file (not just `config.json` or `README.md`)
- Verify the `NPM_TOKEN` secret is set in GitHub repo settings
- Check the Actions tab for workflow run errors

### npm publish failed

- Verify the `NPM_TOKEN` is valid and has write access to the `tokensmith` package
- Check that `npm whoami --registry https://registry.npmjs.org` works with your token
- Ensure the version in `package.json` doesn't already exist on npm

### CI is failing on the Version PR

- The Version PR runs through the same CI gates (typecheck, lint, test, build)
- If it fails, fix the issue on main — the Version PR will auto-update

### I need to undo a published release

npm packages cannot be unpublished after 72 hours. If you published a bad version:

1. Fix the issue in a new PR with a `patch` changeset
2. Merge → the Version PR will create a corrective release
3. Add a deprecation notice: `npm deprecate tokensmith@<bad-version> "Use <new-version> instead"`
