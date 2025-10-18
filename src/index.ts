import { Curve25519Wrapper } from '@privacyresearch/curve25519-typescript';
import { Curve } from './curve';

export * from './types';
export * from './signal-protocol-address';
export * from './key-helper';
export * from './fingerprint-generator';
export * from './session-builder';
export * from './session-cipher';
export * from './session-types';
export * from './curve';

import * as Internal from './internal';

export { setWebCrypto, setCurve } from './internal';
export { setLogger, getLogger } from './logger';

/**
 * Builds a compatibility wrapper that mirrors the legacy
 * `libsignal-protocol-javascript` default export. Consumers that still rely
 * on the older CommonJS shape can `await` this function and interact with the
 * returned object instead of migrating immediately.
 *
 * @returns A promise resolving to an object with a `Curve` instance bound to the
 * underlying curve25519 wrapper.
 */
const createLegacyWrapper = async () => {
    const cw = await Curve25519Wrapper.create();

    return {
        Curve: new Curve(new Internal.Curve(cw)),
    };
};

export default createLegacyWrapper;
