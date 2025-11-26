/**
 * Build a browser bundle for the cross-browser chat demo.
 *
 * This creates a single bundle.js that exposes the Signal Protocol
 * classes on window.SignalProtocol
 */

import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

async function build() {
    await esbuild.build({
        entryPoints: [join(__dirname, 'browser-entry.mjs')],
        bundle: true,
        outfile: join(__dirname, 'bundle.js'),
        format: 'iife',
        globalName: 'SignalProtocol',
        platform: 'browser',
        target: ['chrome90', 'firefox90', 'safari15', 'edge90'],
        minify: false, // Keep readable for demo
        sourcemap: true,
        // Handle the Node.js require() fallback for msrcrypto
        plugins: [{
            name: 'ignore-msrcrypto',
            setup(build) {
                // Ignore the msrcrypto import - browsers have native WebCrypto
                build.onResolve({ filter: /msrcrypto/ }, () => ({
                    path: 'msrcrypto',
                    namespace: 'ignore',
                }));
                build.onLoad({ filter: /.*/, namespace: 'ignore' }, () => ({
                    contents: 'export default {}',
                }));
            },
        }],
    });

    console.log('Bundle created: examples/cross-browser-chat/bundle.js');
}

build().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
