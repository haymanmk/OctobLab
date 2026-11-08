import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { openBoard, card } from './helpers';

async function touch(cdp: CDPSession, pts: [number, number][]) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const viewport = (page: Page) => page.locator('.react-flow__viewport').evaluate(el => el.style.transform);

test('phone: tabs, finger pan, card drag by title, tap opens the reader', async ({ page, context }) => {
  page.on('pageerror', e => { throw new Error('page error: ' + e.message); });
  await openBoard(page);
  await expect(page.getByTestId('app')).toHaveAttribute('data-mode', 'phone');
  await expect(page.getByTestId('app')).toHaveAttribute('data-input', 'touch');
  const cdp = await context.newCDPSession(page);
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  const v0 = await viewport(page);
  await touch(cdp, [[pane.x + 60, pane.y + pane.height - 60], [pane.x + 70, pane.y + pane.height - 80], [pane.x + 90, pane.y + pane.height - 120], [pane.x + 120, pane.y + pane.height - 170]]);
  expect(await viewport(page)).not.toBe(v0);
  await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(450);
  const hb = (await page.locator(card('the-nonlinear-dob') + ' .card-head').boundingBox())!;
  const p0 = await page.locator(card('the-nonlinear-dob')).evaluate(el => el.style.transform);
  await touch(cdp, [[hb.x + 30, hb.y + 8], [hb.x + 30, hb.y + 30], [hb.x + 30, hb.y + 70], [hb.x + 30, hb.y + 110]]);
  const p1 = await page.locator(card('the-nonlinear-dob')).evaluate(el => el.style.transform);
  expect(p1).not.toBe(p0);
  await touch(cdp, [[pane.x + 40, pane.y + pane.height - 40], [pane.x + 50, pane.y + pane.height - 60], [pane.x + 70, pane.y + pane.height - 90]]);
  expect(await page.locator(card('the-nonlinear-dob')).evaluate(el => el.style.transform)).toBe(p1);
  const body = (await page.locator(card('the-nonlinear-dob') + ' .card-body').boundingBox())!;
  await page.touchscreen.tap(body.x + 30, body.y + 20);
  await expect(page.getByTestId('app')).toHaveAttribute('data-mtab', 'read');
  await expect(page.getByTestId('reader-title')).toHaveText('The nonlinear DOB');
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByTestId('app')).toHaveAttribute('data-mtab', 'notes');
  await expect(page.getByTestId('sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Board' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
});
