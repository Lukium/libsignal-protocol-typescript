# PWA Integration Example

This example illustrates how to wire the library into a Progressive Web App with
Service Worker + IndexedDB storage. It does not ship a bundled build; instead it
provides TypeScript sources you can adapt to your own tooling (Vite, Webpack,
etc.). If you want a runnable Vite setup out of the box, see
`../pwa-vite/`.

## Files

- `index.html` – minimal UI shell that registers the Service Worker and sets up status updates.
- `app.ts` – main thread bootstrap that creates the IndexedDB store and exposes message helpers.
- `service-worker.ts` – Service Worker script handling push events and background processing.
- `queue.ts` – simple offline queue abstraction (`IndexedDB`-based).

The example reuses the shared adapter in
`../storage-adapters/indexeddb-adapter.ts`.

## Running locally

1. Bundle the TypeScript sources (e.g. with Vite):

    ```bash
    npm create vite@latest libsignal-pwa -- --template vanilla-ts
    cd libsignal-pwa
    npm install
    ```

2. Copy the files from this directory (and the IndexedDB adapter) into the Vite
   project under `src/`.

3. Register the Service Worker in `main.ts`:

    ```ts
    import './app';
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
    ```

4. Start the dev server:

    ```bash
    npm run dev
    ```

The example logs encryption/decryption results in both the page and Service
Worker consoles.

## Next steps

- Replace the stubbed `sendMessage` logic with your network transport.
- Hook push payloads into `handleIncomingMessage` in `service-worker.ts`.
- Expand the offline queue to coordinate with your application state.

See `docs/pwa-guide.md` for detailed guidance.
