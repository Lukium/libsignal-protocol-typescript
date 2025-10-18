import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function ensureExists(relativePath, description) {
    const absolute = resolve(repoRoot, relativePath);
    try {
        await access(absolute);
    } catch {
        throw new Error(`${description} not found at ${relativePath}`);
    }
    return absolute;
}

async function main() {
    try {
        const cjsIndex = require('../lib/cjs');
        assert(typeof cjsIndex.SessionCipher === 'function', 'CJS index missing SessionCipher export');

        const cjsSubpath = require('../lib/cjs/session-cipher.js');
        assert(
            typeof cjsSubpath.SessionCipher === 'function',
            'CJS session-cipher subpath missing SessionCipher export'
        );

        const optionalExports = ['session-builder', 'session-record', 'fingerprint-generator', 'key-helper'];
        for (const name of optionalExports) {
            const cjsModule = require(`../lib/cjs/${name}.js`);
            assert(Object.keys(cjsModule).length > 0, `CJS subpath ${name} has no exports`);
            await ensureExists(`lib/esm/${name}.js`, `ESM subpath ${name}`);
        }

        await ensureExists('lib/esm/index.js', 'ESM index bundle');
        await ensureExists('lib/esm/session-cipher.js', 'ESM session-cipher bundle');

        const pkg = require(resolve(repoRoot, 'package.json'));
        const exportEntries = Object.entries(pkg.exports || {});
        assert(exportEntries.length > 0, 'package.json exports map is empty');

        for (const [subpath, target] of exportEntries) {
            if (typeof target === 'string') {
                await ensureExists(target, `Export "${subpath}"`);
                continue;
            }
            if (target && typeof target === 'object') {
                if (target.import) {
                    await ensureExists(target.import, `Export "${subpath}" (import)`);
                }
                if (target.require) {
                    await ensureExists(target.require, `Export "${subpath}" (require)`);
                }
                if (target.types) {
                    await ensureExists(target.types, `Export "${subpath}" (types)`);
                }
            }
        }

        console.log('✅ Dual build smoke test passed');
    } catch (error) {
        console.error('❌ Dual build smoke test failed');
        console.error((error && error.stack) || error);
        process.exitCode = 1;
    }
}

main();
