import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
    testDir: './tests/playwright',
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        headless: true,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: devices['Desktop Chrome'],
        },
    ],
    webServer: {
        command: 'yarn preview:pwa-vite',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
