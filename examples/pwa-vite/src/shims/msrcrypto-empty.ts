const missing = (): never => {
    throw new Error(
        'msrcrypto fallback requested. Ensure globalThis.crypto is available before using libsignal-protocol-typescript.'
    );
};

export default {
    subtle: {
        digest: missing,
    },
    getRandomValues: missing,
    randomUUID: missing,
};
