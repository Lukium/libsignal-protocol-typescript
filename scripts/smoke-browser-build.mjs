import { build } from 'esbuild';
import { rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outdir = resolve(repoRoot, 'dist', 'smoke-browser');
const outfile = resolve(outdir, 'bundle.js');

async function main() {
    try {
        // Clean previous bundle.
        rmSync(outdir, { force: true, recursive: true });
    } catch (_) {
        // ignore
    }

    try {
        await build({
            entryPoints: [resolve(__dirname, 'smoke-browser-entry.mjs')],
            bundle: true,
            format: 'esm',
            platform: 'browser',
            target: ['es2020'],
            outfile,
            logLevel: 'silent',
            external: [
                'path',
                'fs',
                '@lukium/libsignal-protocol-typescript/lib/msrcrypto.js',
                '../lib/msrcrypto',
                '../../lib/msrcrypto',
            ],
        });

        const content = readFileSync(outfile, 'utf8');
        if (!content.includes('smokeBundleArtifacts')) {
            throw new Error('Browser smoke bundle did not include expected exports.');
        }

        console.log('✅ Browser bundle smoke test passed');
    } catch (error) {
        console.error('❌ Browser bundle smoke test failed');
        console.error(error instanceof Error ? error.stack : error);
        process.exitCode = 1;
    }
}

main();
