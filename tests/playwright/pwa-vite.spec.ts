import { test, expect } from '@playwright/test';

const LOG_LOCATOR = '#log';
const SEND_BUTTON = '#send';

async function waitForLogEntry(page, text: string) {
    const log = page.locator(LOG_LOCATOR);
    await expect(log).toBeVisible({ timeout: 20_000 });
    await expect(log).toContainText(text, { timeout: 20_000 });
}

test.describe('Vite PWA demo', () => {
    test('establishes session and decrypts worker response', async ({ page }) => {
        await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

        await waitForLogEntry(page, 'Service Worker active');
        await waitForLogEntry(page, 'Session established');

        const sendButton = page.locator(SEND_BUTTON);
        await expect(sendButton).toBeEnabled({ timeout: 20_000 });
        await sendButton.click();

        await waitForLogEntry(page, 'Worker decrypted');
    });
});
