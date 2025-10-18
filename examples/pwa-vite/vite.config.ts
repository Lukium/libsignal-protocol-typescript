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
        alias: [
            {
                find: '@example/indexeddb-adapter',
                replacement: path.resolve(__dirname, '../storage-adapters/indexeddb-adapter.ts'),
            },
            {
                find: /^@privacyresearch\/libsignal-protocol-typescript$/,
                replacement: path.join(libEsmDir, 'index.js'),
            },
            {
                find: /^@privacyresearch\/libsignal-protocol-typescript\/(.*)$/,
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
