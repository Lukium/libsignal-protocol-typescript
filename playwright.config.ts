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
        {
            name: 'firefox',
            use: devices['Desktop Firefox'],
            // Firefox doesn't support ES module Service Workers (type: 'module')
            // Only run core library tests, skip SW-dependent tests
            testIgnore: /pwa-vite\.spec\.ts/,
        },
        {
            name: 'webkit',
            use: devices['Desktop Safari'],
        },
    ],
    webServer: {
        command: 'yarn preview:pwa-vite',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
