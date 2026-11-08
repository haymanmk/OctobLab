import { test, expect } from '@playwright/test';

test('the reading page carries the whole article with math, code and the live widget', async ({ page }) => {
  await page.goto('posts/ndob/read/');
  await expect(page.locator('h1')).toHaveText('Nonlinear Disturbance Observer for Robot Control');
  await expect(page.locator('article section')).toHaveCount(9);
  expect(await page.locator('.katex').count()).toBeGreaterThan(10);
  await expect(page.locator('pre.shiki')).toHaveCount(1);
  await expect(page.locator('.widget canvas')).toBeVisible();
  await page.getByRole('link', { name: 'Open on the board' }).click();
  await expect(page).toHaveURL(/posts\/ndob\/$/);
});

test('feed and sitemap exist under the base path', async ({ request }) => {
  const rss = await request.get('rss.xml');
  expect(rss.ok()).toBeTruthy();
  const body = await rss.text();
  expect(body).toContain('Nonlinear Disturbance Observer');
  expect(body).toContain('/OctobLab/posts/ndob/read/');
  const sm = await request.get('sitemap-index.xml');
  expect(sm.ok()).toBeTruthy();
});
