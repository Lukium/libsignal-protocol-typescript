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

1. Commit the generated `docs/api/` output to a temporary branch (for example `gh-pages-build`).
2. Push the branch and configure GitHub Pages to serve from `/docs` on the default branch **or** publish the build artifacts to the `gh-pages` branch.
   - GitHub Pages is free for public repositories; private repositories require a paid plan.
   - When using the `gh-pages` branch, the HTML must live at the repository root.
3. Verify that the site renders correctly (e.g., `https://<your-user>.github.io/<repo>/`).

## Automation options

- Use the `gh-pages` npm package or GitHub Actions to publish `docs/api/` automatically after `yarn docs:api` runs on the main branch.
- Ensure CI caches TypeDoc output if the command is part of the release pipeline.

## Maintenance tips

- Regenerate the docs whenever public APIs change.
- Keep `CHANGELOG.md` and `docs/README.md` updated with the active documentation URL.
- If hosting elsewhere, adjust the paths in `typedoc.json` accordingly.
