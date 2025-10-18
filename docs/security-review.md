# Security Review Checklist

_Last updated: 2025-10-19_

Use this list before cutting a release (especially betas) to ensure the library ships with a clean dependency set and no unexpected bundle changes.

## 1. Dependency Health

1. `yarn npm audit` – verify the report finishes with “No audit suggestions”.
2. `yarn npm ls --depth=0` – sanity check that no unexpected packages are installed (investigate extraneous/resolution overrides).
3. Cross-check `docs/dependencies.md` for any TODO items or deferred updates that should block the release.

## 2. Bundle Integrity

1. `yarn bundle:size` – capture the gzipped output of `examples/pwa-vite` and confirm it remains ≤110 KB.
2. `yarn smoke:build` – ensure the dual CJS/ESM outputs and subpath exports load cleanly.
3. Review the diff under `lib/**` if a fresh build shows uncommitted changes.

## 3. Test & Coverage Gates

1. `yarn test --coverage` – confirm coverage remains ≥95% statements / ≥90% branches (protobuf and internal wrappers already excluded as documented).
2. `yarn test:e2e` – run the Playwright smoke test for the PWA demo.
3. `yarn benchmark` (optional) – spot check that performance has not regressed significantly.

## 4. Logging & Telemetry

1. If a custom logger is configured in downstream apps, verify `setLogger` is still invoked as expected.
2. For releases, reset the logger to defaults and confirm no stray console output remains during `yarn test --coverage`.

## 5. Finalise Release Notes

1. Update `CHANGELOG.md` with the release version and highlight any security fixes.
2. Tag the release (e.g., `v0.1.0-beta.1`) after `yarn release:beta` succeeds.
3. Publish the npm package with `--tag next`, then record follow-up tasks for the Phase 3 handoff.
