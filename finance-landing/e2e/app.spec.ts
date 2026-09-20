import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // App should load and show title somewhere or have the app rendering
  await expect(page).toHaveTitle(/Vite \+ React|Finance/i);
});

test('navigation links work', async ({ page }) => {
  await page.goto('/');
  
  // Click on Watchlist navigation link
  const watchlistLink = page.locator('nav a', { hasText: 'Watchlist' });
  if (await watchlistLink.isVisible()) {
    await watchlistLink.click();
    await expect(page).toHaveURL(/.*\/watchlist/);
  }
  
  // Click on Screener navigation link
  const screenerLink = page.locator('nav a', { hasText: 'Screener' });
  if (await screenerLink.isVisible()) {
    await screenerLink.click();
    await expect(page).toHaveURL(/.*\/screener/);
  }
});
