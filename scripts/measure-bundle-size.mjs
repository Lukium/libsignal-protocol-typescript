import { rmSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const distDir = resolve('examples/pwa-vite/dist');

try {
    rmSync(distDir, { recursive: true, force: true });
} catch (err) {
    console.error('Failed to clean dist directory', err);
}

const buildLib = spawnSync('yarn', ['build'], {
    stdio: 'inherit',
    shell: false,
});

if (buildLib.status !== 0) {
    process.exit(buildLib.status ?? 1);
}

const buildDemo = spawnSync('yarn', ['build:pwa-vite'], {
    stdio: 'inherit',
    shell: false,
});

if (buildDemo.status !== 0) {
    process.exit(buildDemo.status ?? 1);
}

function collectFiles(dir, predicate) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(full, predicate));
        } else if (predicate(full)) {
            files.push(full);
        }
    }
    return files;
}

const jsFiles = collectFiles(distDir, (file) => file.endsWith('.js'));

let totalBytes = 0;
let totalGzip = 0;

for (const file of jsFiles) {
    const contents = readFileSync(file);
    totalBytes += contents.length;
    totalGzip += gzipSync(contents).length;
}

const formatKB = (bytes) => (bytes / 1024).toFixed(2);

console.log('\nBundle size report');
console.log('===================');
console.log(`JavaScript files: ${jsFiles.length}`);
console.log(`Total raw size: ${totalBytes} bytes (${formatKB(totalBytes)} KiB)`);
console.log(`Total gzipped: ${totalGzip} bytes (${formatKB(totalGzip)} KiB)`);

if (totalGzip > 102400) {
    console.warn('\n⚠️  Gzipped size exceeds 100 KiB target.');
    process.exitCode = 1;
}
