import { build } from 'esbuild';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outdir = resolve(repoRoot, 'dist', 'smoke-browser');
const outfile = resolve(outdir, 'bundle.js');

const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
// The built ESM entry the browser bundle should resolve against.
const builtEsmEntry = resolve(repoRoot, 'lib', 'esm', 'index.js');

async function main() {
    // The smoke entry imports the package by its own name. esbuild only resolves
    // that self-reference when the build output exists, so fail early with a
    // clear message instead of esbuild's opaque "Could not resolve" error.
    if (!existsSync(builtEsmEntry)) {
        console.error('❌ Browser bundle smoke test failed');
        console.error(`Built ESM entry not found at ${builtEsmEntry}. Run "yarn build" first.`);
        process.exitCode = 1;
        return;
    }

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
            external: ['path', 'fs'],
            // Resolve the package's self-reference deterministically to the built
            // ESM entry rather than relying on esbuild's exports-field resolution,
            // which silently fails when the build output is absent or relocated.
            alias: {
                [pkg.name]: builtEsmEntry,
            },
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
