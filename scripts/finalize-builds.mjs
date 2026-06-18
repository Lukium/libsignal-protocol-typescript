/**
 * Post-build finalizer for the dual CJS/ESM output.
 *
 * TypeScript (with `moduleResolution: bundler`) emits ESM with EXTENSIONLESS
 * relative imports and no package-type marker, which native Node ESM cannot
 * resolve. This script:
 *   1. Writes `lib/cjs/package.json` ({"type":"commonjs"}) and
 *      `lib/esm/package.json` ({"type":"module"}) so Node treats each tree
 *      correctly regardless of the root package's type.
 *   2. Rewrites relative import/export specifiers in lib/esm/**.js to add the
 *      correct `.js` (file) or `/index.js` (directory) suffix.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(process.cwd(), 'lib');

writeFileSync(join(root, 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
writeFileSync(join(root, 'esm', 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

// Matches the specifier in: `from '...'`, `import '...'`, `import('...')`.
// Covers `.`, `..`, `./x`, `../x` (bare current/parent dir included).
const SPEC_RE = /((?:\bfrom|\bimport)\s*\(?\s*)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g;

function withExtension(fileDir, spec) {
    if (/\.(js|json|mjs|cjs)$/.test(spec)) return spec; // already explicit
    const target = resolve(fileDir, spec);
    if (existsSync(`${target}.js`)) return `${spec}.js`;
    if (existsSync(target) && statSync(target).isDirectory() && existsSync(join(target, 'index.js'))) {
        return `${spec.replace(/\/$/, '')}/index.js`;
    }
    return spec; // leave untouched if unresolved
}

// Native ESM JSON imports require an import attribute; tsc (module ES2020)
// does not emit one, so add it to the ESM output (idempotent).
const JSON_RE = /(\bfrom\s*)(['"])([^'"]+\.json)\2(?!\s*with)/g;

// protobufjs/light is CJS and does not expose named ESM exports, so a named
// import (`import { Root } from 'protobufjs/light.js'`) fails under Node ESM.
// Rewrite it to a default import + destructure in the ESM output.
const PB_NAMED_RE = /import\s*\{([^}]+)\}\s*from\s*(['"])(protobufjs\/light\.js)\2;?/g;

let rewritten = 0;
for (const file of walk(join(root, 'esm'))) {
    const fileDir = dirname(file);
    const src = readFileSync(file, 'utf8');
    let next = src.replace(SPEC_RE, (m, lead, q, spec) => `${lead}${q}${withExtension(fileDir, spec)}${q}`);
    next = next.replace(JSON_RE, (m, lead, q, spec) => `${lead}${q}${spec}${q} with { type: 'json' }`);
    next = next.replace(
        PB_NAMED_RE,
        (m, names, q, spec) => `import __pbLight from ${q}${spec}${q};\nconst {${names}} = __pbLight;`
    );
    if (next !== src) {
        writeFileSync(file, next);
        rewritten++;
    }
}

console.log(`finalize-builds: wrote type markers; rewrote ESM specifiers in ${rewritten} file(s).`);
