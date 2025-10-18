# Contributing Guide

Thanks for your interest in improving `@privacyresearch/libsignal-protocol-typescript`! This guide outlines the local workflow, coding standards, and release routines for contributors.

## Prerequisites

- Node.js 18+
- Yarn 4 (Corepack-enabled)
- `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium` (run once if you will execute the E2E suite)

## Getting Started

```bash
yarn install --immutable
```

We use the node-modules linker for compatibility with tooling.

## Validation Checklist

Before opening a PR, make sure the following commands succeed:

```bash
yarn lint
yarn test
yarn bundle:size
```

Run `yarn bundle:size` to ensure the Vite PWA demo stays within the Phase 2 size ceiling (≤110 KB gzipped). For documentation updates, run `yarn docs:api` if the public API surface changed.

## End-to-end Tests

A Playwright smoke test covers the Vite demo:

```bash
yarn test:e2e
```

This is optional for doc-only changes but required for PWA or Service Worker modifications. Chromium is installed into `.playwright-browsers` to avoid global installs.

## Coding Standards

- TypeScript: prefer explicit types on exported APIs; avoid `any` unless absolutely necessary.
- Formatting: enforced by Prettier; let `yarn lint`/`yarn format` fix styling issues.
- Tests: Jest is limited to a single worker; add coverage when touching protocol code or storage adapters.
- Bundle health: be mindful of optional imports—use subpath exports (e.g., `@privacyresearch/libsignal-protocol-typescript/session-cipher`) to keep tree-shaking effective.

## Documentation & Release Notes

- Update `docs/` when behavior or workflows change.
- Record noteworthy updates in `CHANGELOG.md`.
- Regenerate TypeDoc output via `yarn docs:api` when altering public APIs. Publishing instructions live in `docs/api-publishing.md`.

## Opening Pull Requests

1. Fork the repo and create a branch (`git checkout -b feature/my-change`).
2. Commit using Conventional Commit messages (`feat:`, `fix:`, `docs:`, etc.). PRs without lint/test/bundle checks will be blocked by CI.
3. Push and open a PR. Describe motivation, testing performed, and bundle impact if applicable.
4. Respond to review feedback promptly and keep the branch up to date with `master`.

## Releases

Maintainers should run:

```bash
yarn release:beta
```

This runs lint, tests, bundle check, and builds artifacts before publishing. After verifying the changelog and docs, publish with:

```bash
npm publish --tag next
```

Then push tags/commits and update the release notes.

## Need Help?

Open an issue in GitHub or contact the maintainers at [maintainers@example.com](mailto:maintainers@example.com).

Happy hacking!
