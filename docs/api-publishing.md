# API Documentation Publishing Guide

This project uses [TypeDoc](https://typedoc.org/) to generate the HTML reference located under `docs/api/`. The content is ignored by git so it can be regenerated on demand.

## Prerequisites

- GitHub repository access with rights to push branches.
- GitHub Pages enabled (public repositories are free; private repos require a paid plan).
- Node.js environment with project dependencies installed.

## Generate the documentation

```bash
yarn docs:api
```

This command clears `docs/api/` and regenerates the static HTML output.

## Publish to GitHub Pages

## Automated Publishing (Recommended)

This repository includes `.github/workflows/publish-docs.yml`. On every push to `master`, the action:

1. Installs dependencies (`yarn install --immutable`).
2. Runs `yarn docs:api` to regenerate TypeDoc output.
3. Deploys the contents of `docs/api/` to the `gh-pages` branch using `peaceiris/actions-gh-pages`.

After the workflow runs, GitHub Pages can be enabled via **Settings → Pages** by selecting `gh-pages / root`. The site will be available at `https://<user>.github.io/<repo>/`.

Public repositories can use GitHub Pages for free; private repositories require a paid plan.

### Manual Publishing (Optional)

If you prefer a manual flow:

1. Run `yarn docs:api` locally.
2. Copy the generated files in `docs/api/` to a temporary directory.
3. Commit them to a branch (`gh-pages`) at the repository root (`index.html`, `assets/`, etc.).
4. Push the branch and configure Pages to use it.

## Automation options

- Use the `gh-pages` npm package or GitHub Actions to publish `docs/api/` automatically after `yarn docs:api` runs on the main branch.
- Ensure CI caches TypeDoc output if the command is part of the release pipeline.

## Maintenance tips

- Regenerate the docs whenever public APIs change.
- Keep `CHANGELOG.md` and `docs/README.md` updated with the active documentation URL.
- If hosting elsewhere, adjust the paths in `typedoc.json` accordingly.
