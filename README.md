
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/Lukium/libsignal-protocol-typescript?style=for-the-badge)
[<image src="https://img.shields.io/npm/v/%40lukium%2Flibsignal-protocol-typescript?style=for-the-badge&label=npm"></image>](https://www.npmjs.com/package/@lukium/libsignal-protocol-typescript)
![npm downloads](https://img.shields.io/npm/dm/%40lukium%2Flibsignal-protocol-typescript?style=for-the-badge)
![npm types](https://img.shields.io/npm/types/%40lukium%2Flibsignal-protocol-typescript?style=for-the-badge)
<br>
[<image src="https://img.shields.io/discord/629066705057873922?style=for-the-badge&label=discord"></image>](https://discord.gg/lukium)


# Signal Protocol TypeScript Library

> Modernized fork of the legacy `libsignal-protocol-javascript`, maintained for browser and PWA deployments.

> ### 🤖 AI-assisted development disclaimer
>
> This modernization is **substantially developed with AI assistance** — including
> but not limited to OpenAI's **Codex** and Anthropic's **Claude**, often used in
> collaboration — under the direction and review of [@Lukium](https://github.com/Lukium).
> AI tooling contributed heavily to implementation, the WebCrypto migration,
> tests, and documentation. Treat this as you would any dependency handling
> cryptography: **review the source and run your own validation** before relying
> on it in production. The project has **not** undergone an independent
> third-party security audit.

> ## ⚠️ Upcoming breaking change — WebCrypto curve migration
>
> | | |
> | --- | --- |
> | **Current / latest stable** | **`0.1.0-beta.2`** — canonical Signal identity (single Curve25519 key, **XEdDSA**) on the bundled asm.js curve. Universal browser support. |
> | **Next release line (`0.2.0-beta.x`+, in progress)** | Native **WebCrypto** `X25519` + `Ed25519`. Adopts a **two-key, Olm-style identity** (separate Ed25519 signing + X25519 DH keys). **Breaking**: identity key format and `KeyHelper` API change; requires Chrome 137+ / Firefox 130+ / Safari 17+. |
>
> **Want the current behavior? Pin to `0.1.0-beta.2`** — it will not receive the breaking change:
>
> ```bash
> npm install @lukium/libsignal-protocol-typescript@0.1.0-beta.2
> # or
> yarn add @lukium/libsignal-protocol-typescript@0.1.0-beta.2
> ```
> ```jsonc
> // package.json — exact pin (no caret), stays on the canonical single-key build
> "@lukium/libsignal-protocol-typescript": "0.1.0-beta.2"
> ```
>
> The `0.2.0-beta.x` line and later will **not** interoperate with `0.1.x` peers
> (different identity-key format) nor with the real Signal network. See
> [Cryptographic Backend (Curve25519)](#cryptographic-backend-curve25519) for the
> full rationale, comparison chart, and migration notes.

## Modernization Status

- **Phase 1 (Foundation) — Completed.** Jest, TypeScript, and dual CJS/ESM builds are repaired and emitting declarations.
- **Phase 2 (Modernization) — Completed.** Browser-first tooling, IndexedDB adapters, Playwright smoke tests, and logging hooks shipped in `@lukium/libsignal-protocol-typescript@0.1.0-beta.1`.
- **Phase 3 (Enhancement) — Planned.** the **WebCrypto curve-backend migration** (see [Cryptographic Backend](#cryptographic-backend-curve25519)) is underway. PQXDH support, regenerated protobufs, and additional example applications are tracked in [`docs/modernization-plan.md`](docs/modernization-plan.md).
- **Browser-first focus.** WebCrypto-backed crypto with IndexedDB guidance remains the default; see [`docs/browser-compatibility.md`](docs/browser-compatibility.md) for supported environments.

For a complete overview, visit [`docs/README.md`](docs/README.md).

## Cryptographic Backend (Curve25519)

> **Status: migration in progress.** Today the elliptic-curve operations (X25519
> key agreement and identity signatures) are provided by the bundled asm.js
> [`@privacyresearch/curve25519-typescript`](https://www.npmjs.com/package/@privacyresearch/curve25519-typescript).
> We are migrating these to **native WebCrypto** (`X25519` + `Ed25519` via
> `SubtleCrypto`) behind the existing `setCurve()` seam. A feasibility spike
> (`spikes/webcrypto-curve-x3dh.mjs`) has validated that a WebCrypto X3DH
> handshake agrees on both sides and that Ed25519 signed-prekey verification
> works. The symmetric layer (AES-CBC + HMAC-SHA256) is unchanged.

### Why WebCrypto

The asm.js curve is the single unmaintained dependency carrying the most
security-critical math (the actual Diffie-Hellman and signatures). Moving to
browser-native primitives is the highest-value modernization for downstream
adopters:

| Dimension | asm.js `curve25519-typescript` (current) | WebCrypto native `X25519` + `Ed25519` (target) |
| --- | --- | --- |
| **Performance** | Pure JS/asm.js, single-threaded (~5x slower than native) | Hardware-accelerated, async, near-native |
| **Bundle size** | Ships the asm.js curve as a dependency | Browser built-in -> drops the dependency |
| **Maintenance** | `@0.0.12`, effectively unmaintained | Maintained by the Chrome/Firefox/Safari teams |
| **Audit surface** | The DH/signing math is JS you ship and must audit | Primitive lives in the browser, outside your bundle |
| **Constant-time / side-channel** | JS not guaranteed constant-time | Vendor implementations are constant-time / hardened |
| **Private-key exposure** | Key bytes always live in JS memory (XSS surface) | Can use non-extractable handles (planned follow-on) |
| **Browser support** | Universal (it is just JS) | `X25519`: Chrome/Edge 133+, Firefox 130+, Safari 17+ (~83%); `Ed25519`: Chrome 137+, Firefox 129+, Safari 17+ (~79%) |
| **Identity model** | Canonical Signal: one key, XEdDSA | Two keys (Ed25519 sign + X25519 DH), Olm-style |
| **Real Signal-network interop** | Possible | No (out of scope for this library) |

Sources: [Secure Curves in the Web Cryptography API (WICG spec)](https://wicg.github.io/webcrypto-secure-curves/) ·
[Ed25519 lands in Chrome (Igalia)](https://blogs.igalia.com/jfernandez/2025/08/25/ed25519-support-lands-in-chrome-what-it-means-for-developers-and-the-web/) ·
[caniuse: X25519 `deriveBits`](https://caniuse.com/mdn-api_subtlecrypto_derivebits_x25519).

### Architectural difference: two-key (Olm-style) identity

WebCrypto cannot express XEdDSA — it provides `Ed25519` (signing) and `X25519`
(key agreement) as **separate, non-interconvertible** key types. Canonical Signal
uses a *single* Curve25519 identity key for both jobs via XEdDSA; that is
impossible with pure WebCrypto. The migration therefore adopts a **two-key
identity**:

- **Ed25519 identity key** — signs signed-prekeys (replaces XEdDSA signatures).
- **X25519 identity key** — performs the X3DH Diffie-Hellman exchanges.

This is the same separation used by **Matrix's Olm/Megolm** (distinct Ed25519
fingerprint/signing and Curve25519 identity keys). Consequences:

- **Security:** equivalent — separating signing and DH keys is a sound,
  well-precedented design.
- **Interop:** this library no longer interoperates with the *real Signal
  network* (which expects XEdDSA single-key identities). Two peers both using
  this library interoperate normally; cross-network Signal interop was never a
  goal here.
- **Format:** an identity now carries **two** public keys, and signed-prekey
  signatures are plain `Ed25519` (not XEdDSA). Existing XEdDSA signature test
  vectors are regenerated; X25519 key-agreement and symmetric-ratchet vectors are
  unaffected.

### Planned follow-on: non-extractable keys

The initial migration keeps the curve interface byte-in/byte-out (private keys
are imported per call), so it captures the performance, audit-surface,
maintenance, and constant-time wins but **not** non-extractability. A later
follow-on will let consumers hold identity (and, where the ratchet allows, DH)
keys as **non-extractable** `CryptoKey` handles so private key bytes never enter
JS memory — a meaningful XSS-hardening step, tracked separately.

## Installation

```bash
yarn add @lukium/libsignal-protocol-typescript
# or
npm install @lukium/libsignal-protocol-typescript
```

> **Heads up:** the `0.2.0-beta.x` line migrates to native WebCrypto with a
> breaking identity-key format change. To stay on the current canonical-Signal
> build, pin to `0.1.0-beta.2` — see the **Upcoming breaking change** notice at
> the top of this README.

ES module consumption is recommended:

```ts
import {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
} from '@lukium/libsignal-protocol-typescript';
```

## Documentation

- [`docs/MIGRATION.md`](docs/MIGRATION.md) – upgrade notes from v0.0.16.
- [`docs/pwa-guide.md`](docs/pwa-guide.md) – IndexedDB + Service Worker integration tips.
- [`docs/browser-compatibility.md`](docs/browser-compatibility.md) – supported browsers and WebCrypto requirements.
- [`docs/limitations.md`](docs/limitations.md) – known gaps and planned follow-ups.

## Code layout

```
/lib                # contains MSR's crypto library
/src                # TS source files
/src/__test__       # Tests
/src/__test-utils__ # Test Utilities
```

## Overview

A ratcheting forward secrecy protocol that works in synchronous and
asynchronous messaging environments.

### PreKeys

This protocol uses a concept called 'PreKeys'. A PreKey is an ECPublicKey and
an associated unique ID which are stored together by a server. PreKeys can also
be signed.

At install time, clients generate a single signed PreKey, as well as a large
list of unsigned PreKeys, and transmit all of them to the server.

### Sessions

Signal Protocol is session-oriented. Clients establish a "session," which is
then used for all subsequent encrypt/decrypt operations. There is no need to
ever tear down a session once one has been established.

Sessions are established in one of two ways:

1. PreKeyBundles. A client that wishes to send a message to a recipient can
   establish a session by retrieving a PreKeyBundle for that recipient from the
   server.
1. PreKeySignalMessages. A client can receive a PreKeySignalMessage from a
   recipient and use it to establish a session.

### State

An established session encapsulates a lot of state between two clients. That
state is maintained in durable records which need to be kept for the life of
the session.

State is kept in the following places:

- Identity State. Clients will need to maintain the state of their own identity
  key pair, as well as identity keys received from other clients.
- PreKey State. Clients will need to maintain the state of their generated
  PreKeys.
- Signed PreKey States. Clients will need to maintain the state of their signed
  PreKeys.
- Session State. Clients will need to maintain the state of the sessions they
  have established.

## Usage

The code samples below come almost directly from our [sample web application](https://github.com/privacyresearchgroup/libsignal-typescript-demo). Please have a look there to see how everything fits together. Look at this project's unit tests too.

### Add the SDK to your project

We use [yarn](https://yarnpkg.com).

```
yarn add @lukium/libsignal-protocol-typescript
```

But npm is good too:

```
npm install @lukium/libsignal-protocol-typescript
```

Now you can import classes and functions from the library. To make the examples below work, the following import suffices:

```

#### Install time

At install time, a signal client needs to generate its identity keys,
registration id, and prekeys.

A signal client also needs to implement a storage interface that will manage
loading and storing of identity, prekeys, signed prekeys, and session state.
See [`src/__test__/storage-type.ts`]() for an example.

Here is what setup might look like:

```ts
const createID = async (name: string, store: SignalProtocolStore) => {
  const registrationId = KeyHelper.generateRegistrationId();
  storeSomewhereSafe(`registrationID`, registrationId);

  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  storeSomewhereSafe('identityKey', identityKeyPair);

  const baseKeyId = makeKeyId();
  const preKey = await KeyHelper.generatePreKey(baseKeyId);
  store.storePreKey(`${baseKeyId}`, preKey.keyPair);

  const signedPreKeyId = makeKeyId();
  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);
  store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

  // Now we register this with the server or other directory so all users can see them.
  // You might implement your directory differently, this is not part of the SDK.

  const publicSignedPreKey: SignedPublicPreKeyType = {
    keyId: signedPreKeyId,
    publicKey: signedPreKey.keyPair.pubKey,
    signature: signedPreKey.signature,
  };

  const publicPreKey: PreKeyType = {
    keyId: preKey.keyId,
    publicKey: preKey.keyPair.pubKey,
  };

  directory.storeKeyBundle(name, {
    registrationId,
    identityPubKey: identityKeyPair.pubKey,
    signedPreKey: publicSignedPreKey,
    oneTimePreKeys: [publicPreKey],
  });
};
```

Relevant type definitions and classes: [KeyHelper](), [KeyPairType](), [PreKeyPairType](), [SignedPreKeyPairType](),
[PreKeyType](), [SignedPublicPreKeyType]().

### Building a session

Once this is implemented, building a session is fairly straightforward:

```ts
const starterMessageBytes = Uint8Array.from([
  0xce, 0x93, 0xce, 0xb5, 0xce, 0xb9, 0xce, 0xac, 0x20, 0xcf, 0x83, 0xce, 0xbf, 0xcf, 0x85,
]);

const startSessionWithBoris = async () => {
  // get Boris' key bundle. This is a DeviceType<ArrayBuffer>
  const borisBundle = directory.getPreKeyBundle('boris');

  // borisAddress is a SignalProtocolAddress
  const recipientAddress = borisAddress;

  // Instantiate a SessionBuilder for a remote recipientId + deviceId tuple.
  const sessionBuilder = new SessionBuilder(adiStore, recipientAddress);

  // Process a prekey fetched from the server. Returns a promise that resolves
  // once a session is created and saved in the store, or rejects if the
  // identityKey differs from a previously seen identity for this address.
  await sessionBuilder.processPreKey(borisBundle!);

  // Now we can encrypt a messageto get a MessageType object
  const senderSessionCipher = new SessionCipher(adiStore, recipientAddress);
  const ciphertext = await senderSessionCipher.encrypt(starterMessageBytes.buffer);

  // The message is encrypted, now send it however you like.
  sendMessage('boris', 'adalheid', ciphertext);
};
```

Relevant type definitions: [DeviceType](), [SignalProtocolAddress](), [MessageType](), [SessionBuilder](), [SessionCipher]()

_Note:_ As discussed below, the Signal protocol uses two message types: `PreKeyWhisperMessage` and `WhisperMessage` that are defined
in [the protobuf definitions]() and implemented in [libsignal-protocol-protobuf-ts](https://github.com/privacyresearchgroup/libsignal-protocol-protobuf-ts). The message created in the sample above is a `PreKeyWhisperMessage`. It carries information needed for the recipient to build a session with the [X3DH Protocol](https://signal.org/docs/specifications/x3dh/). After a session is established for a recipient, `SessionCipher.encrypt()` will return a simpler `WhisperMessage`.

> **\*Into the weeds:** The function `sessionCipher.encrypt()` always returns a [`MessageType`]() object. Sometimes it is a `PreKeyWhisperMessage` and sometimes it is a `WhisperMessage`. To distinguish, check `ciphertext.type`. If `ciphertext.type === 3` then `ciphertext.body` contains a serialized `PreKeyWhisperMessage`. If `ciphertext.type === 1` then `ciphertext.body` contains a serialized `WhisperMessage`.\*

### Encrypting

Once you have a session established with an address, you can encrypt messages
using SessionCipher.

```ts
const plaintext = 'μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος / οὐλομένην, ἣ μυρί᾽ Ἀχαιοῖς ἄλγε᾽ ἔθηκε';
const buffer = new TextEncoder().encode(plaintext).buffer;

const sessionCipher = new SessionCipher(store, address);
const ciphertext = await sessionCipher.encrypt(buffer);
// If we've already established a session, thenciphertext.type === 1.

// Now we can send it over the channel of our choice
sendMessage('adalheid', 'boris', ciphertext);
```

### Decrypting

Ciphertexts come in two flavors: WhisperMessage and PreKeyWhisperMessage.

```ts
const address = new SignalProtocolAddress(recipientId, deviceId);
const sessionCipher = new SessionCipher(store, address);

// Decrypting a PreKeyWhisperMessage will establish a new session and
// store it in the SignalProtocolStore. It returns a promise that resolves
// when the message is decrypted or rejects if the identityKey differs from
// a previously seen identity for this address.

let plaintext: ArrayBuffer;
// ciphertext: MessageType
if (ciphertext.type === 3) {
  // It is a PreKeyWhisperMessage and will establish a session.
  try {
    plaintext = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext.body!, 'binary');
  } catch (e) {
    // handle identity key conflict
  }
} else if (ciphertext.type === 1) {
  // It is a WhisperMessage for an established session.
  plaintext = await sessionCipher.decryptWhisperMessage(ciphertext.body!, 'binary');
}

// now you can do something with your plaintext, like
const secretMessage = new TextDecoder().decode(new Uint8Array(plaintext));
```

## Injecting Dependencies

This library uses [WebCrypto]() for symmetric key cryptography and random number generation. It uses an implemenation of the [AsyncCurve](https://github.com/privacyresearchgroup/curve25519-typescript/blob/master/src/types.ts#L21) interface in [`curve25519-typescript`](https://github.com/privacyresearchgroup/curve25519-typescript) for public key operations.

Functional defaults are provided for each but you may want to provide your own, either for performance or security reasons.

### WebCrypto defaults and injection

By default this library will use `window.crypto` if it is present. Otherwise it uses [`msrcrypto`](https://www.npmjs.com/package/msrcrypto). If you are falling back to `msrcrypto` you will want to consider providing a substitute.

To replace the WebCrypto component with your own, simply call `setWebCrypto` as follows:

```ts
setWebCrypto(myCryptImplementation);
```

Your WebCrypto imlementation does not need to support the entire interface, but does need to implement:

- AES-CBC
- HMAC SHA-256
- `getRandomValues`

### Elliptic curve crypto defaults and injection

By default this library uses the curve X25519 implementation in [`curve25519-typescript`](https://github.com/privacyresearchgroup/curve25519-typescript). This is a javascript implementation, compiled into [asm.js](http://asmjs.org/) from C with [emscripten](https://emscripten.org/). You may want to provide a native implementation or even use a different curve, like X448. To do this, wrap your implementation into a an object that implements the [AsyncCurve](https://github.com/privacyresearchgroup/curve25519-typescript/blob/master/src/types.ts#L21) interface and set it as follows:

```ts
setCurve(myCurve);
```

## License

Copyright © 2020-2025 Lukium. Originally created by Privacy Research, LLC.

Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
