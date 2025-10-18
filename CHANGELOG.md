# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Added IndexedDB multi-device integration harness exercising SessionBuilder/SessionCipher real flows.
- Shipped Vite PWA demo with Playwright automation and README guidance.
- Introduced TypeDoc configuration and `yarn docs:api` command for regenerating API docs.
- Added bundle-size measurement script (`yarn bundle:size`) and adjusted Phase 2 target to ≤110 KB gzipped.
- Removed `Buffer` dependency from push message codecs to keep browser bundles lean.
- Documented release workflow (`yarn release:beta`) and updated `prepublishOnly` to enforce lint/test/size/build checks.
- Introduced `yarn benchmark` to capture baseline performance for key generation, session setup, encrypt/decrypt.
