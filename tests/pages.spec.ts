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

test('the design article renders its math and tables, and its simulation runs and responds', async ({ page }) => {
  await page.goto('posts/ndob-design/read/');
  await expect(page.locator('h1')).toHaveText('Designing a Nonlinear Disturbance Observer, Step by Step');
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page.locator('article table')).toHaveCount(2);
  const w = page.locator('.widget');
  await w.scrollIntoViewIfNeeded();
  await expect(w.locator('.st')).toHaveText('● live');
  const snap = () => w.locator('canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL().slice(-80));
  const a = await snap(); await page.waitForTimeout(400); expect(await snap()).not.toBe(a);
  await expect(w.locator('.readout')).toContainText('27.5');
  await w.getByLabel(/Convergence rate/).fill('50');
  await expect(w.locator('.readout')).toContainText('68.3');
  await w.getByRole('button', { name: 'Joint 2' }).click();
  await expect(w.getByRole('button', { name: 'Joint 2' })).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.locator('.post')).toHaveCount(2);
  await expect(page.locator('.post').first().locator('h3')).toHaveText('Designing a Nonlinear Disturbance Observer, Step by Step');
  const post = page.locator('.post', { hasText: 'Nonlinear Disturbance Observer for Robot Control' });
  await expect(post.locator('h3')).toHaveText('Nonlinear Disturbance Observer for Robot Control');
  await expect(post.getByRole('link', { name: 'Open the board' })).toHaveAttribute('href', /posts\/ndob\/$/);
  await expect(post.getByRole('link', { name: 'Read as a page' })).toHaveAttribute('href', /posts\/ndob\/read\/$/);
  await page.locator('.tagrow a', { hasText: 'control' }).click();
  await expect(page).toHaveURL(/articles\/tag\/control\/$/);
  await expect(page.locator('h2')).toHaveText('control');
  await expect(page.locator('.post')).toHaveCount(2);
  await page.goto('');
  await page.getByRole('navigation').getByRole('link', { name: 'Articles' }).click();
  await expect(page).toHaveURL(/articles\/$/);
});

test('the home page stage plays the three clips in turn and the columns switch it', async ({ page }) => {
  await page.goto('');
  const videos = page.locator('.stage-video');
  await expect(videos).toHaveCount(3);
  await expect(videos.nth(0)).toBeVisible();
  await expect(videos.nth(1)).toBeHidden();
  await expect(page.locator('.how .step').nth(0)).toHaveClass(/active/);
  await page.locator('.how .step').nth(2).click();
  await expect(videos.nth(2)).toBeVisible();
  await expect(videos.nth(0)).toBeHidden();
  await expect(page.locator('.how .step').nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.stage-now')).toContainText('Reader');
  // the clip ends and the stage moves on to the first one by itself
  await page.locator('.stage-video').nth(2).evaluate(v => { const el = v as HTMLVideoElement; if (el.duration) el.currentTime = el.duration - 0.2; });
  await expect(videos.nth(0)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.stage-now')).toContainText('Contents');
});
