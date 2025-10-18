# Basic Messaging Example

_Status: Ready_

This example mirrors the simplest end-to-end flow: Alice and Bob establish a
session, exchange a single encrypted payload, and log the decrypted plaintext.
The logic lives in `index.ts` for direct imports and is also exposed through a
CLI runner so you can smoke-test the bundle without additional tooling.

## Usage

```bash
yarn build                  # ensure lib/esm + lib/cjs exist
yarn example:basic          # logs "hello from alice"
yarn example:basic "hola"   # override the outbound payload
```

Behind the scenes the script at `demo.mjs` consumes the built ESM output, so
the CLI doubles as a regression check that our packaging stays functional.
You can still import the helper directly:

```ts
import { demo } from './examples/basic-messaging/index';

const plaintext = await demo('custom payload');
```

Maintains:

- In-memory `SignalProtocolStore` implementation for quick experimentation.
- Clean teardown with isolated registration IDs for each device.

Planned follow-ups:

- Wire into Jest as a smoke test after CI runtime stabilises.
- Expand payload verification to cover session re-use and error branches.
