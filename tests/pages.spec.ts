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

test('the diffusion article renders, and its reverse-step demo turns normal as the step size shrinks', async ({ page }) => {
  await page.goto('posts/diffusion-small-steps/read/');
  await expect(page.locator('h1')).toHaveText('Why Small Steps Make the Reverse Diffusion Step Normal');
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page.locator('article table')).toHaveCount(2);
  const w = page.locator('[data-widget="reverse-step"] .widget');
  await expect(w.locator('canvas')).toBeVisible();
  await w.scrollIntoViewIfNeeded();
  await expect(w.locator('.readout')).toContainText('17.9 %');
  const snap = () => w.locator('canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL().slice(-80));
  const a = await snap();
  await w.getByLabel(/Step size/).fill('-3');
  await expect(w.locator('.readout')).toContainText('under 0.1 %');
  expect(await snap()).not.toBe(a);
  await w.getByRole('button', { name: 'Reset' }).click();
  await expect(w.locator('.readout')).toContainText('17.9 %');
});

test('the diffusion article draws the forward and reverse chain, and a larger step size needs fewer steps', async ({ page }) => {
  await page.goto('posts/diffusion-small-steps/read/');
  const w = page.locator('[data-widget="diffusion-chain"] .widget');
  await expect(w.locator('canvas')).toBeVisible();
  await w.scrollIntoViewIfNeeded();
  await expect(w.locator('canvas')).toHaveAttribute('data-photo', 'ready');
  const steps = w.locator('.readout div').first();
  await expect(steps).toContainText('228');
  // moving the slider shows the finished picture, so the two snapshots differ only by the step size
  await w.getByLabel(/Step size/).fill('-2');
  await expect(steps).toContainText('459');
  await expect(w.locator('.wtitle')).toContainText('done');
  const snap = () => w.locator('canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL().slice(-80));
  const a = await snap();
  await w.getByLabel(/Step size/).fill('-1');
  await expect(steps).toContainText('44');
  expect(await snap()).not.toBe(a);
  await w.getByRole('button', { name: 'Reset' }).click();
  await expect(steps).toContainText('228');
});

test('collapsed cards render their summary as Markdown, and a preview block shows the chosen parts of the body', async ({ page }) => {
  await page.goto('posts/ndob-design/');
  const sum = (id: string) => page.locator(`.react-flow__node-card[data-id="${id}"] .sum`);
  // <!-- summary: … --> with inline math
  await expect(sum('step-1-lump-everything-into-one-disturbance').locator('.katex')).toHaveCount(2);
  await expect(sum('step-1-lump-everything-into-one-disturbance')).not.toContainText('$');
  // <!-- preview --> regions: the display formula and the closing paragraph, joined
  const chosen = sum('step-4-solve-it-with-one-formula');
  await expect(chosen.locator('.katex-display')).toHaveCount(1);
  await expect(chosen).toContainText('That is the whole design.');
  await expect(chosen).not.toContainText('Schur');
  // neither: the opening of the first paragraph, as plain text
  await page.goto('posts/ndob/');
  await expect(page.locator('.react-flow__node-card[data-id="root"] .sum')).toContainText('disturbance observer');
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

test('the articles page lists every post, the title opens its board, and tag pages filter', async ({ page }) => {
  await page.goto('articles/');
  await expect(page.locator('h2')).toContainText('article');
  await expect(page.locator('.post')).toHaveCount(3);
  await expect(page.locator('.post').first().locator('h3')).toHaveText('Why Small Steps Make the Reverse Diffusion Step Normal');
  const post = page.locator('.post', { hasText: 'Nonlinear Disturbance Observer for Robot Control' });
  await expect(post.locator('h3')).toHaveText('Nonlinear Disturbance Observer for Robot Control');
  // the title is the one way in; the board itself offers "Read as a page"
  await expect(post.locator('h3 a')).toHaveAttribute('href', /posts\/ndob\/$/);
  await expect(post.getByRole('link', { name: 'Read as a page' })).toHaveCount(0);
  await page.locator('.tagrow a', { hasText: 'control' }).click();
  await expect(page).toHaveURL(/articles\/tag\/control\/$/);
  await expect(page.locator('h2')).toHaveText('control');
  await expect(page.locator('.post')).toHaveCount(2);
  // the back arrow on a board returns to this list, not to the home page
  await page.goto('posts/ndob/');
  await page.getByRole('link', { name: 'All articles' }).click();
  await expect(page).toHaveURL(/articles\/$/);
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

test('a link to another heading works on the board: it opens that card, and Back returns', async ({ page }) => {
  page.on('pageerror', e => { throw new Error('page error: ' + e.message); });
  await page.addInitScript(() => localStorage.setItem('octoblab.helpSeen', 'true'));
  const title = page.getByTestId('reader-title');
  const selected = page.locator('.react-flow__node-card .card.selected');
  // from the reader
  await page.goto('posts/diffusion-small-steps/#root');
  await expect(title).toHaveText('Why Small Steps Make the Reverse Diffusion Step Normal');
  await page.locator('.reader .content a[href="#try-it"]').click();
  await expect(title).toHaveText('Try it');
  await expect(selected).toHaveAttribute('data-id', 'try-it');
  await expect(page.locator('.react-flow__node-card[data-id="try-it"]')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => location.hash)).toBe('#try-it');
  await page.goBack();
  await expect(title).toHaveText('Why Small Steps Make the Reverse Diffusion Step Normal');
  await page.goForward();
  await expect(title).toHaveText('Try it');
  // from a card expanded on the board
  await page.goto('posts/diffusion-small-steps/');
  await expect(page.locator('.react-flow__node-card')).toHaveCount(15);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.locator('.react-flow__node-card[data-id="root"] .tog').click();
  await page.locator('.react-flow__node-card[data-id="root"] .card-body a[href="#try-it"]').click();
  await expect(title).toHaveText('Try it');
  // the address of a heading opens its card, including the article's own H1
  await page.goto('posts/diffusion-small-steps/read/');
  await page.goto('posts/diffusion-small-steps/#why-small-steps-make-the-reverse-diffusion-step-normal');
  await expect(title).toHaveText('Why Small Steps Make the Reverse Diffusion Step Normal');
  // card text never leaves real ids on the board, so the browser cannot scroll the canvas to a fragment
  expect(await page.locator('.reader .content [id], .card-body [id]').count()).toBe(0);
});

test('the reading page gives the title and the sections their heading ids', async ({ page }) => {
  await page.goto('posts/diffusion-small-steps/read/');
  await expect(page.locator('h1')).toHaveAttribute('id', 'why-small-steps-make-the-reverse-diffusion-step-normal');
  await page.locator('article a[href="#try-it"]').click();
  await expect(page.locator('section#try-it')).toBeInViewport();
});
