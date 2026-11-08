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

test('the articles page lists every post with both ways to read it, and tag pages filter', async ({ page }) => {
  await page.goto('articles/');
  await expect(page.locator('h2')).toContainText('article');
  const post = page.locator('.post').first();
  await expect(post.locator('h3')).toHaveText('Nonlinear Disturbance Observer for Robot Control');
  await expect(post.getByRole('link', { name: 'Open the board' })).toHaveAttribute('href', /posts\/ndob\/$/);
  await expect(post.getByRole('link', { name: 'Read as a page' })).toHaveAttribute('href', /posts\/ndob\/read\/$/);
  await page.locator('.tagrow a', { hasText: 'control' }).click();
  await expect(page).toHaveURL(/articles\/tag\/control\/$/);
  await expect(page.locator('h2')).toHaveText('control');
  await expect(page.locator('.post')).toHaveCount(1);
  await page.goto('');
  await page.getByRole('navigation').getByRole('link', { name: 'Articles' }).click();
  await expect(page).toHaveURL(/articles\/$/);
});
