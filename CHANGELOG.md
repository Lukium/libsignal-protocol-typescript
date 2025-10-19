# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Bumped package scope to `@lukium` and added browser esbuild smoke testing to release flow.

## 0.1.0-beta.2 (2025-10-19)

- README refreshed to reflect Phase 2 completion, Lukium stewardship, and updated licensing attribution.

## 0.1.0-beta.1 (2025-10-19)

- Ported the project to `@lukium/libsignal-protocol-typescript`.
- Added optional `setLogger`/`getLogger` hooks and browser-compatible bundle validation (`yarn smoke:browser`).
- Documented the security review checklist and updated all guides for the new scope and commands.
- Added IndexedDB multi-device integration harness exercising SessionBuilder/SessionCipher real flows.
- Shipped Vite PWA demo with Playwright automation and README guidance.
- Introduced TypeDoc configuration and `yarn docs:api` command for regenerating API docs.
- Added bundle-size measurement script (`yarn bundle:size`) and adjusted Phase 2 target to ≤110 KB gzipped.
- Removed `Buffer` dependency from push message codecs to keep browser bundles lean.
- Documented release workflow (`yarn release:beta`) and updated `prepublishOnly` to enforce lint/test/size/build checks.
- Introduced `yarn benchmark` to capture baseline performance for key generation, session setup, encrypt/decrypt.
- Added `yarn smoke:build` to validate CJS/ESM outputs and optional entry points after each build.
- Added `yarn example:basic` CLI harness to exercise the basic messaging demo against packaged artifacts.
- Updated the Vite PWA example with offline queue handling and refreshed documentation references.
- Expanded test coverage to >90% branches with new environment fallbacks and session-cipher edge cases (protobuf output excluded from coverage totals).
- Added configurable logging hooks (`setLogger`/`getLogger`) so apps can forward structured telemetry instead of relying on console output.
