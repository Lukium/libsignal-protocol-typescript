import {
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
    setLogger,
} from '@lukium/libsignal-protocol-typescript';

// Ensure logger hook tree-shakes cleanly when bundling for the browser.
setLogger({
    warn() {
        // no-op
    },
    error() {
        // no-op
    },
});

// Reference primary exports so bundlers resolve package entry points.
export const smokeBundleArtifacts = {
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
};
