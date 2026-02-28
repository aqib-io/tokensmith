# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

Each `.md` file (other than this README) represents a pending version bump. When you make a change that should be released, run:

```bash
npx changeset
```

Follow the prompts to select a semver bump type (patch / minor / major) and describe the change. Commit the generated file with your PR.

The release workflow will consume these files automatically — you never need to edit `package.json` version or `CHANGELOG.md` by hand.
