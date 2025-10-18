# Phase 1: Foundation - Implementation Checklist

**Duration**: Weeks 1-3
**Goal**: Establish a stable, modern foundation for the library
**Status**: In Progress

---

## Week 1: Test Infrastructure and Build System

### Day 1-2: Fix Jest Configuration

- [x] **Identify and fix Jest environment error**
  - File: `src/__test-utils__/custom-jest-environment.js`
  - Issue: `TypeError: Class extends value #<Object> is not a constructor or null`
  - Solution: Import `TestEnvironment` from `jest-environment-node` and forward `setup/teardown` to the base class.

- [x] **Update jestconfig.json**
  ```json
  {
    "transform": {
      "^.+\\.ts$": "ts-jest"
    },
    "testRegex": "(src/__test__/.*\\.test\\.ts|(\\.|/)(test|spec))\\.ts$",
    "moduleFileExtensions": ["ts", "tsx", "js", "jsx", "json", "node"],
    "testEnvironment": "./src/__test-utils__/custom-jest-environment.js",
    "maxWorkers": 1,
    "collectCoverage": true,
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
  ```
  > `maxWorkers` remains pinned until the Jest worker crash (exitCode 0) is resolved upstream.

- [x] **Run all tests and verify they pass**
  ```bash
  yarn test
  ```

- [x] **Add coverage reporting**
  ```bash
  yarn test --coverage
  ```

- [x] **Document test results**
  - Record baseline coverage percentage
    - 2025-10-17 baseline: 92% statements / 81% branches / 94% functions / 92% lines.
  - Document any remaining test failures
    - None; 210 specs passing with custom Jest environment.
  - Create issues for any complex fixes needed
    - Track residual gaps in `session-cipher.ts` deep error branches and `session-record` archival flows.

### Day 3-4: Update Build Configuration

- [x] **Create modern tsconfig setup**
  - Files: `tsconfig.base.json`, `tsconfig.cjs.json`, `tsconfig.esm.json`, `tsconfig.json`
  - Update target to ES2020
  - Enable strict mode & strict null checks
  - Provide declaration/source maps
  - Configure for dual build (ESM + CommonJS)

  ```json
  {
    "extends": "./tsconfig.base.json",
    "compilerOptions": {
      "module": "ES2020",
      "outDir": "./lib/esm"
    }
  }
  ```

- [x] **Create tsconfig.cjs.json (for CommonJS build)**
  - Extends `tsconfig.base.json`, sets `"module": "CommonJS"`, `"moduleResolution": "node"`, `"outDir": "./lib/cjs"`

- [x] **Update package.json build scripts**
  ```json
  {
    "scripts": {
      "test": "jest --config jestconfig.json",
      "test:watch": "jest --config jestconfig.json --watch",
      "test:coverage": "jest --config jestconfig.json --coverage",
      "lint": "eslint -c .eslintrc.js  '**/*.ts'",
      "lint:fix": "eslint -c .eslintrc.js  '**/*.ts' --fix",
      "format": "prettier '**/{*.{js?(on),ts?(x),md},.*.js?(on)}' --write --list-different --config prettier.config.js",
      "format:check": "prettier '**/{*.{js?(on),ts?(x),md},.*.js?(on)}' --check --config prettier.config.js",
      "typecheck": "tsc --noEmit",
      "prepare": "yarn run build",
      "clean": "node -e \"const fs=require('fs');const path=require('path');for (const dir of ['lib/cjs','lib/esm']) { try { fs.rmSync(dir,{recursive:true,force:true}); } catch (err) { if (err.code !== 'ENOENT') throw err; } } try { for (const entry of fs.readdirSync('lib',{withFileTypes:true})) { if (entry.isDirectory()) continue; if (entry.name === 'msrcrypto.js') continue; fs.rmSync(path.join('lib', entry.name), { force: true }); } } catch (err) { if (err.code !== 'ENOENT') throw err; }\"",
      "build": "yarn clean && yarn build:cjs && yarn build:esm",
      "build:cjs": "tsc -p tsconfig.cjs.json",
      "build:esm": "tsc -p tsconfig.esm.json",
      "prepublishOnly": "yarn run lint",
      "preversion": "yarn run lint && yarn test",
      "version": "yarn run format && git add -A src",
      "postversion": "git push && git push --tags"
    },
    "main": "lib/cjs/index.js",
    "module": "lib/esm/index.js",
    "types": "lib/cjs/index.d.ts",
    "exports": {
      ".": {
        "import": "./lib/esm/index.js",
        "require": "./lib/cjs/index.js",
        "types": "./lib/cjs/index.d.ts"
      },
      "./package.json": "./package.json"
    }
  }
  ```

- [x] **Test build**
  ```bash
  yarn build
  ```

- [x] **Verify output**
  - Check `lib/esm/` contains ES modules
  - Check `lib/cjs/` contains CommonJS modules
  - Check `.d.ts` files are generated
  - Check source maps are present

### Day 5: CI/CD Setup

- [x] **Create GitHub Actions workflow**
  - File: `.github/workflows/ci.yml`

  ```yaml
  name: CI

  on:
    push:
      branches: [master, main]
    pull_request:
      branches: [master, main]

  jobs:
    quality:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          node-version: [18.x, 20.x]
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node-version }}
            cache: yarn
            cache-dependency-path: .yarn/install-state.gz
        - run: yarn install --immutable
        - run: yarn lint
        - run: yarn typecheck
        - run: yarn test --coverage
        - run: yarn build
        - name: Upload coverage artifact
          if: matrix.node-version == '20.x'
          uses: actions/upload-artifact@v4
          with:
            name: coverage-lcov
            path: coverage/lcov.info
            if-no-files-found: ignore
  ```

- [ ] **Test CI workflow locally (optional)**
  ```bash
  # Install act: https://github.com/nektos/act
  act -j quality
  ```

- [ ] **Create PR template**
  - File: `.github/PULL_REQUEST_TEMPLATE.md`

  ```markdown
  ## Description
  <!-- Describe your changes -->

  ## Type of Change
  - [ ] Bug fix
  - [ ] New feature
  - [ ] Breaking change
  - [ ] Documentation update
  - [ ] Refactoring
  - [ ] Performance improvement

  ## Testing
  - [ ] Tests pass locally
  - [ ] New tests added (if applicable)
  - [ ] Coverage maintained or improved

  ## Checklist
  - [ ] Code follows project style guidelines
  - [ ] Self-review completed
  - [ ] Comments added for complex code
  - [ ] Documentation updated
  - [ ] No new warnings generated
  ```

---

## Week 2: Dependencies and Code Quality

### Day 1-2: Dependency Audit

- [ ] **Run security audit**
  ```bash
  yarn audit
  ```

- [ ] **Review outdated packages**
  ```bash
  yarn outdated
  ```

- [ ] **Update dev dependencies** (test each update)
  ```bash
  # Update safely
  yarn upgrade-interactive --latest

  # Or individually:
  yarn upgrade @typescript-eslint/eslint-plugin@latest
  yarn upgrade @typescript-eslint/parser@latest
  yarn upgrade prettier@latest
  yarn upgrade jest@latest
  yarn upgrade ts-jest@latest
  ```

- [ ] **Audit production dependencies**
  - [ ] `@privacyresearch/curve25519-typescript`
    - Check for updates
    - Verify security
    - Document if replacement needed

  - [ ] `@privacyresearch/libsignal-protocol-protobuf-ts`
    - Check if protobuf definitions are current
    - Compare with official Signal protobuf
    - Document update plan

  - [ ] `base64-js`
    - Consider native base64 APIs
    - Document decision to keep or replace

- [ ] **Document dependency decisions**
  - File: `docs/dependencies.md`
  - List each dependency
  - Explain why kept or replaced
  - Document versions and rationale

### Day 3-4: Code Quality Tooling

- [ ] **Update ESLint configuration**
  - File: `.eslintrc.js` or `.eslintrc.json`

  ```javascript
  module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      project: './tsconfig.json'
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'prettier'
    ],
    plugins: ['@typescript-eslint'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': 'warn'
    }
  }
  ```

- [ ] **Add/update Prettier configuration**
  - File: `.prettierrc` or `prettier.config.js`

  ```json
  {
    "semi": false,
    "singleQuote": true,
    "trailingComma": "es5",
    "printWidth": 100,
    "tabWidth": 2,
    "useTabs": false,
    "arrowParens": "avoid"
  }
  ```

- [ ] **Add Prettier ignore file**
  - File: `.prettierignore`

  ```
  lib
  node_modules
  coverage
  *.md
  ```

- [ ] **Set up Husky for Git hooks**
  ```bash
  yarn add -D husky lint-staged
  npx husky install
  npx husky add .husky/pre-commit "yarn lint-staged"
  ```

- [ ] **Configure lint-staged**
  - Add to `package.json`:

  ```json
  {
    "lint-staged": {
      "*.ts": [
        "eslint --fix",
        "prettier --write",
        "git add"
      ],
      "*.{json,md}": [
        "prettier --write",
        "git add"
      ]
    }
  }
  ```

- [ ] **Add commitlint (optional but recommended)**
  ```bash
  yarn add -D @commitlint/cli @commitlint/config-conventional
  npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
  ```

- [ ] **Create commitlint config**
  - File: `.commitlintrc.json`

  ```json
  {
    "extends": ["@commitlint/config-conventional"],
    "rules": {
      "type-enum": [
        2,
        "always",
        [
          "feat",
          "fix",
          "docs",
          "style",
          "refactor",
          "perf",
          "test",
          "chore",
          "revert"
        ]
      ]
    }
  }
  ```

### Day 5: Fix Linting Issues

- [ ] **Run linter and fix auto-fixable issues**
  ```bash
  yarn lint:fix
  ```

- [ ] **Manually fix remaining issues**
  - Focus on critical errors
  - Document complex issues for Phase 2
  - Create issues for non-critical warnings

- [ ] **Format all code**
  ```bash
  yarn format
  ```

- [ ] **Verify build still works**
  ```bash
  yarn build
  ```

- [ ] **Verify tests still pass**
  ```bash
  yarn test
  ```

---

## Week 3: Documentation Baseline

### Day 1-2: API Documentation

- [ ] **Audit public API surface**
  - List all exported functions, classes, types
  - Document current behavior
  - Identify undocumented APIs

- [ ] **Add JSDoc comments to main exports**
  - File: `src/index.ts`
  - All exported items need JSDoc

  ```typescript
  /**
   * Generates a new identity key pair for Signal Protocol.
   *
   * @returns A promise resolving to a key pair with public and private keys
   * @throws {Error} If key generation fails
   *
   * @example
   * ```typescript
   * const keyPair = await KeyHelper.generateIdentityKeyPair()
   * console.log(keyPair.pubKey, keyPair.privKey)
   * ```
   */
  export function generateIdentityKeyPair(): Promise<KeyPairType> {
    // ...
  }
  ```

- [ ] **Add JSDoc to public classes**
  - `SignalProtocolAddress`
  - `SessionBuilder`
  - `SessionCipher`
  - `KeyHelper`
  - `FingerprintGenerator`

- [ ] **Document type interfaces**
  - File: `src/types.ts`
  - Add JSDoc to all exported types

### Day 3: Usage Documentation

- [ ] **Update README.md**
  - Add modernization notice
  - Update installation instructions
  - Update basic usage examples
  - Add link to full documentation

- [ ] **Create examples directory**
  - File structure:
    ```
    examples/
    ├── README.md
    ├── basic-messaging/
    │   ├── index.ts
    │   └── README.md
    ├── pwa-integration/
    │   ├── index.html
    │   ├── service-worker.js
    │   └── README.md
    └── storage-adapters/
        ├── indexeddb-adapter.ts
        └── README.md
    ```

- [ ] **Create basic messaging example**
  - File: `examples/basic-messaging/index.ts`
  - Show complete flow: key gen → session → encrypt → decrypt

- [ ] **Document current limitations**
  - File: `docs/limitations.md`
  - Known issues
  - Missing features
  - Browser compatibility notes

### Day 4: Migration Guide

- [ ] **Create migration guide from v0.0.16**
  - File: `docs/MIGRATION.md`
  - Document all breaking changes
  - Provide code examples for common migrations
  - List deprecated APIs

- [ ] **Create comparison with official API**
  - File: `docs/official-comparison.md`
  - Show differences from @signalapp/libsignal-client
  - Explain naming differences
  - Document feature parity

### Day 5: Browser Compatibility

- [ ] **Create browser compatibility matrix**
  - File: `docs/browser-compatibility.md`

  | Browser | Version | Status | Notes |
  |---------|---------|--------|-------|
  | Chrome | 90+ | ✅ Supported | |
  | Firefox | 88+ | ✅ Supported | |
  | Safari | 14+ | ⚠️ Testing needed | WebCrypto quirks |
  | Edge | 90+ | ✅ Supported | Chromium-based |

- [ ] **Document WebCrypto API requirements**
  - Required APIs: AES-CBC, HMAC-SHA256, getRandomValues
  - Browser support matrix
  - Polyfill options (if any)

- [ ] **Create PWA integration guide**
  - File: `docs/pwa-guide.md`
  - Service Worker usage
  - IndexedDB storage
  - Offline support
  - Bundle size considerations

---

## Phase 1 Completion Checklist

### Testing
- [ ] All existing tests passing
- [ ] Coverage >80%
- [ ] No test flakiness
- [ ] CI passing on all PRs

### Build System
- [ ] ESM and CJS builds working
- [ ] TypeScript declarations generated
- [ ] Source maps present
- [ ] Build size documented

### Code Quality
- [ ] Linter configured and passing
- [ ] Formatter configured
- [ ] Git hooks working
- [ ] No critical ESLint errors

### Dependencies
- [ ] Security audit clean
- [ ] All dependencies updated (or documented why not)
- [ ] Dependency decisions documented

### Documentation
- [ ] README updated
- [ ] API documentation started
- [ ] Examples created
- [ ] Browser compatibility documented
- [ ] Migration guide started

### CI/CD
- [ ] GitHub Actions workflow running
- [ ] Tests run on all PRs
- [ ] Build verification on all PRs
- [ ] PR template created

---

## Success Criteria

Phase 1 is considered complete when:

1. ✅ **All tests pass** with >80% coverage
2. ✅ **Build produces** both ESM and CJS outputs
3. ✅ **CI/CD is operational** and passing
4. ✅ **Dependencies are audited** and up to date
5. ✅ **Code quality tools** are configured and passing
6. ✅ **Basic documentation** is in place

After Phase 1 completion, we have a **stable, modern foundation** to build Phase 2 modernizations upon.

---

## Tracking

Use GitHub Projects or Issues to track progress:

- Create milestone "Phase 1: Foundation"
- Create issues for each major task
- Link issues to this checklist
- Update weekly in team meetings

---

**Last Updated**: 2025-10-17
**Status**: Not Started
**Expected Completion**: Week 3 end
