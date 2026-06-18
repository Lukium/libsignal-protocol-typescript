import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
const libEsmDir = path.resolve(repoRoot, 'lib/esm');
const libEsmDirPosix = libEsmDir.split(path.sep).join('/');

export default defineConfig({
    root: __dirname,
    worker: {
        format: 'es',
        rollupOptions: {
            external: ['@lukium/libsignal-protocol-typescript/lib/msrcrypto.js'],
        },
    },
    build: {
        // The demo (like the WebCrypto backend it showcases) targets modern
        // browsers; esnext allows the top-level await Vite emits in its preload.
        target: 'esnext',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                sw: path.resolve(__dirname, 'src/sw.ts'),
                'test-harness': path.resolve(__dirname, 'test-harness.html'),
            },
            output: {
                entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
            },
        },
    },
    resolve: {
        alias: [
            {
                find: '@example/indexeddb-adapter',
                replacement: path.resolve(__dirname, '../storage-adapters/indexeddb-adapter.ts'),
            },
            {
                find: /^@lukium\/libsignal-protocol-typescript$/,
                replacement: path.join(libEsmDir, 'index.js'),
            },
            {
                find: /^@lukium\/libsignal-protocol-typescript\/(.*)$/,
                replacement: `${libEsmDirPosix}/$1.js`,
            },
        ],
    },
    server: {
        fs: {
            allow: [repoRoot],
        },
    },
});
