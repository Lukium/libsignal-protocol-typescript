# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0-beta.4 (2026-07-05)

- **Fix (ESM interop):** import `protobufjs/minimal` via a default import +
  destructure (`import protobuf from 'protobufjs/minimal.js'; const { Reader, Writer }
  = protobuf`) instead of named imports. The named form added in beta.3
  (`import { Reader, Writer } from 'protobufjs/minimal.js'`) throws
  `SyntaxError: does not provide an export named 'Reader'` under **native ESM**
  (e.g. vitest / Node ESM), because `protobufjs/minimal` is CommonJS and Node's CJS
  interop can't statically detect those named exports. Bundlers (esbuild) and CJS
  interop (jest) tolerated it, so it only broke native-ESM consumers. No runtime or
  wire-format change from beta.3 — supersedes beta.3, which is broken under native ESM.

## 0.2.0-beta.3 (2026-07-05)

- **Fix (CSP compatibility):** the wire-message protobuf codecs
  (`src/protobuf/wire.ts`) no longer use protobufjs's `light` reflection, which
  builds its encode/decode functions with `new Function` and throws `EvalError`
  under a strict `script-src 'self'` CSP without `unsafe-eval` (e.g. a sandboxed
  KMS enclave worker — the worker crashed at startup). `SignalMessage` and
  `PreKeySignalMessage` are now encoded/decoded by hand using the codegen-free
  `protobufjs/minimal` `Writer`/`Reader`, with field numbers/wire types mirroring
  `wire.json`. No wire-format or public-API change; full suite (279 tests),
  typecheck, and lint green.

## 0.2.0-beta.2 (2026-06-18)

- **Fix (packaging):** the package no longer runs `husky` on install. The
  `postinstall: husky install` script ran on every downstream install and failed
  (husky is a dev dependency, absent in a consumer's tree), breaking
  `npm`/`pnpm install` of the package. Husky setup moved to `prepare`, which
  registry-tarball installs do not run — so consumers install cleanly while local
  and git-dependency installs still get the git hooks.
- **Fix (tooling):** `scripts/measure-bundle-size.mjs` no longer triggers Node's
  DEP0190 deprecation — it passes the command as a single string with `shell:true`
  instead of an args array (args are constants, no injection risk).

## 0.2.0-beta.1 (2026-06-18)

- **Security:** `SessionCipher.doDecryptWhisperMessage` now advances the ratchet and consumes message keys on a private clone of the session, committing the new state back only after the MAC verifies. A forged or invalid message can no longer damage a session's ratchet state — previously a concern on the `decryptWithSessionList` by-reference path where a sibling session could be persisted with corrupted state.
- **Security (DoS):** inbound pre-key and whisper messages are now rejected if they fall outside a size band (`MIN`/`MAX_SIGNAL_MESSAGE_BYTES`) before any binary conversion, protobuf decode, MAC-input allocation, or crypto runs, bounding the work an unauthenticated peer/relay can force.
- **Reliability:** fixed an infinite loop in `SessionRecord.removeOldSessions()` that could hang the app when more than one session needed trimming in a single pass (e.g. a bulk-loaded or corrupted record). It now recomputes the oldest closed session each iteration and stops when only open sessions remain.
- **Security (DoS):** decrypt entry points now reject by size _before_ converting the inbound binary string (so a huge string can't force the conversion loop/allocation), and validate decoded `ratchetKey`/`identityKey`/`baseKey` lengths before any ratchet or crypto work.
- **Security (schema):** decoded numeric fields (`counter`, `previousCounter`, `registrationId`, `preKeyId`, `signedPreKeyId`) are validated as finite non-negative safe integers (`isSafeNonNegativeInteger`) before reaching ratchet/session logic, rejecting NaN/negative/fractional/oversized values from a malformed or hostile peer.
- **Security (storage):** `SessionRecord.deserialize()` now enforces caps (serialized length, plain-object `sessions`, session/chain/message-key counts) on the raw parsed structure before nested base64 decoding, so a corrupt or malicious local record can't exhaust memory or brick the decrypt path.
- **Reliability:** `SessionLock` no longer retains every settled job promise/error indefinitely — settled tracking promises are pruned and the retained error list is capped.
- **Demos (defense-in-depth, not shipped in the package):** cross-browser chat relay now caps WebSocket frame size (`maxPayload`), validates message shape and clamps username/bundle/ciphertext sizes, sanitizes usernames to a conservative charset, and binds to `127.0.0.1` by default (set `HOST=0.0.0.0` to opt into LAN exposure); the chat client and PWA-integration demo build log/user-list rows with `textContent`/DOM nodes instead of `innerHTML`; the IndexedDB example adapter keys identities by the address *name* (last-dot device split) and only removes exact/`name.deviceId` session keys, fixing prefix aliasing (e.g. `alice` no longer matches `alicebob.1`). The React and Vue example stores now implement trust-on-first-use instead of trusting every identity key, the React/Vue/basic-messaging/browser in-memory stores use the same exact-or-`name.deviceId` `removeAllSessions` matching, and example pre-key ids use `crypto.getRandomValues()` instead of `Math.random()`. The basic-messaging examples were also fixed to send the two-key `identitySigningKey` so the demo runs after the WebCrypto migration.
- Made `yarn smoke:browser` deterministic: the bundle now resolves the package self-reference via an esbuild alias to the built ESM entry and fails fast with a clear message when the build output is missing (previously failed with an opaque esbuild "Could not resolve" error).
## 0.2.0-beta.0 (2026-06-17)

- Migrated the Curve25519 backend to native WebCrypto (two-key identity: Ed25519 signing + X25519 DH) and removed the asm.js `@privacyresearch/curve25519-typescript` dependency and the `lib/msrcrypto.js` fallback. Now requires native WebCrypto (modern browsers or Node >= 20); bundle reduced to ~41 KiB gzipped.
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
