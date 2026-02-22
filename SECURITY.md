# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✓         |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use one of the following instead:

1. **GitHub private disclosure (preferred):** Open a [Security Advisory](https://github.com/aqib-io/tokensmith/security/advisories/new) directly in this repository. GitHub keeps it private until a fix is published.
2. **Email:** Contact the maintainer via the email listed in `package.json`. Include "tokensmith security" in the subject line.

### What to include

- A description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof-of-concept.
- The TokenSmith version affected (`npm list tokensmith`).
- Any suggested remediation if you have one.

### What to expect

- **Acknowledgement** within 48 hours.
- **Status update** (confirmed / not confirmed / need more info) within 5 business days.
- **Coordinated disclosure** — a fix will be released before the issue is made public. You will be credited in the release notes unless you prefer otherwise.

## Scope

TokenSmith is a client-side / SSR token management library. The following are in scope:

- Token leakage via storage, cross-tab sync, or the `createAuthFetch` fetch wrapper.
- Prototype pollution or injection via JWT parsing.
- Race conditions in the refresh engine that could expose stale or invalid tokens.
- Any behavior that silently bypasses `onAuthFailure` or swallows authentication errors.

The following are out of scope:

- Vulnerabilities in your own backend / token-issuing server.
- Security issues introduced by passing an insecure custom `StorageAdapter`.
- Browser or runtime bugs outside TokenSmith's control.
