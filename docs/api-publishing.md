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

### Option A – Publish from `main/docs`

1. Run `yarn docs:api` locally to generate the HTML.
2. Copy the contents of `docs/api/` (the generated files) into `docs/api-site/` or another tracked directory.
3. Commit the static files (e.g., `docs/api-site/**`) and push to `main`.
4. In **Settings → Pages**, choose “Deploy from a branch : main /docs” (or the directory you created).
5. GitHub Pages will publish the site at `https://<user>.github.io/<repo>/api-site/`.

### Option B – Publish via `gh-pages` (GitHub Actions)

1. Install `gh-pages` or use a GitHub Action to publish the generated output to the `gh-pages` branch.
2. The HTML must live at the repository root of `gh-pages` (e.g., top-level `index.html`).
3. Configure Pages to serve from the `gh-pages` branch.

(Public repositories can use GitHub Pages for free; private repositories require a paid plan.)

## Automation options

- Use the `gh-pages` npm package or GitHub Actions to publish `docs/api/` automatically after `yarn docs:api` runs on the main branch.
- Ensure CI caches TypeDoc output if the command is part of the release pipeline.

## Maintenance tips

- Regenerate the docs whenever public APIs change.
- Keep `CHANGELOG.md` and `docs/README.md` updated with the active documentation URL.
- If hosting elsewhere, adjust the paths in `typedoc.json` accordingly.
