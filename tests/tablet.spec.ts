import { test, expect, type CDPSession } from '@playwright/test';
import { openBoard, selectInReader, highlightCount, highlightCenter } from './helpers';

async function touch(cdp: CDPSession, pts: [number, number][]) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('unfolded screen: board and reader side by side, highlight by touch, drag handle onto the board', async ({ page, context }) => {
  page.on('pageerror', e => { throw new Error('page error: ' + e.message); });
  await openBoard(page, '#the-nonlinear-dob');
  await expect(page.getByTestId('app')).toHaveAttribute('data-mode', 'square');
  await expect(page.getByTestId('reader')).toBeVisible();
  const cdp = await context.newCDPSession(page);
  await selectInReader(page, 4, 60, 'touch');
  await expect(page.getByTestId('pop')).toBeVisible();
  const hb = (await page.getByTestId('pop').getByRole('button', { name: 'Highlight', exact: true }).boundingBox())!;
  await touch(cdp, [[hb.x + 10, hb.y + 10]]);
  await expect.poll(() => highlightCount(page)).toBe(1);
  const hc = (await highlightCenter(page))!;
  await touch(cdp, [[hc.x, hc.y]]);
  await expect(page.getByTestId('pop').locator('button')).toHaveText(['Add note', '⠿ Drag to board', 'Remove']);
  const db = (await page.getByTestId('pop').getByRole('button', { name: '⠿ Drag to board' }).boundingBox())!;
  const board = (await page.getByTestId('board').boundingBox())!;
  await touch(cdp, [[db.x + 10, db.y + 10], [db.x - 40, db.y + 20], [board.x + board.width / 2, board.y + board.height / 2 + 40], [board.x + board.width / 2 + 10, board.y + board.height / 2 + 50]]);
  await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
  await page.waitForTimeout(500);
  const nb = (await page.locator('.react-flow__node-note .card-head').boundingBox())!;
  const q0 = await page.locator('.react-flow__node-note').evaluate(el => el.style.transform);
  await touch(cdp, [[nb.x + 30, nb.y + 8], [nb.x + 30, nb.y + 40], [nb.x + 60, nb.y + 100], [nb.x + 80, nb.y + 140]]);
  const q1 = await page.locator('.react-flow__node-note').evaluate(el => el.style.transform);
  expect(q1).not.toBe(q0);
  await touch(cdp, [[board.x + 40, board.y + board.height - 60], [board.x + 60, board.y + board.height - 90]]);
  expect(await page.locator('.react-flow__node-note').evaluate(el => el.style.transform)).toBe(q1);
});
