# Basic Messaging Example

_Status: Prototype_

`index.ts` exports a `demo()` helper that wires up in-memory stores for Alice and Bob,
performs the X3DH handshake, and round-trips a “hello” payload:

```ts
import { demo } from './examples/basic-messaging/index';

demo().then((result) => {
    console.log(result); // => \"hello from alice\"
});
```

Run it with `ts-node` (or transpile via `tsc` first):

```bash
npx ts-node examples/basic-messaging/index.ts
```

Future work (Phase 2):

1. Add CLI wiring (`yarn example:basic`) with parameterised payloads.
2. Provide Jest smoke tests to keep the example exercised in CI.
