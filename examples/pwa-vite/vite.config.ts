import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');

export default defineConfig({
    root: __dirname,
    worker: {
        format: 'es',
        rollupOptions: {
            external: ['@privacyresearch/libsignal-protocol-typescript/lib/msrcrypto.js'],
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                sw: path.resolve(__dirname, 'src/sw.ts'),
            },
            output: {
                entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
            },
        },
    },
    resolve: {
        alias: {
            '@example/indexeddb-adapter': path.resolve(__dirname, '../storage-adapters/indexeddb-adapter.ts'),
            '@privacyresearch/libsignal-protocol-typescript': path.resolve(repoRoot, 'src/index.ts'),
        },
    },
    server: {
        fs: {
            allow: [repoRoot],
        },
    },
});
