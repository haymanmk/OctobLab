import { test, expect } from '@playwright/test';
import { openBoard, overlaps, card, isCardId, selectInReader, highlightCount, highlightCenter, edgeMidpoint, bgPoint, CARD_COUNT } from './helpers';

test.describe('board on a desktop', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', e => { throw new Error('page error: ' + e.message); });
  });

  test('home links to the board', async ({ page }) => {
    await page.goto('');
    await expect(page).toHaveTitle('OctobLab');
    await page.getByRole('link', { name: 'Open the first article' }).click();
    await expect(page).toHaveURL(/posts\/ndob\/$/);
    await expect(page.locator('.react-flow__node-card')).toHaveCount(CARD_COUNT);
  });

  test('cards lay out as a tree without overlaps and the contents list matches', async ({ page }) => {
    await openBoard(page);
    expect(await overlaps(page)).toEqual([]);
    await expect(page.getByTestId('toc').locator('a')).toHaveCount(CARD_COUNT);
    await expect(page.locator('.react-flow__edge.edge-h')).toHaveCount(CARD_COUNT - 1);
    const rects = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.react-flow__node-card')].map(el => ({ id: el.dataset.id, x: /translate\(([-\d.]+)px/.exec(el.style.transform)?.[1] })));
    const root = rects.find(r => r.id === 'root')!, child = rects.find(r => r.id === 'the-nonlinear-dob')!;
    expect(Number(child.x)).toBeGreaterThan(Number(root.x));
  });

  test('clicking a card opens it in the reader and updates the address', async ({ page }) => {
    await openBoard(page);
    await page.locator(card('the-nonlinear-dob') + ' .card-head h3').click();
    await expect(page.getByTestId('reader-title')).toHaveText('The nonlinear DOB');
    await expect(page.locator(card('the-nonlinear-dob') + ' .card')).toHaveClass(/selected/);
    expect(await page.evaluate(() => location.hash)).toBe('#the-nonlinear-dob');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('reader-title')).toHaveText('Choosing the observer gain');
    await page.getByTestId('toc').locator('a[data-id="what-slowly-varying-costs"]').click();
    await expect(page.getByTestId('reader-title')).toHaveText('What “slowly varying” costs');
    await expect(page.getByTestId('crumbs')).toContainText('Choosing the observer gain');
  });

  test('a deep link opens that card', async ({ page }) => {
    await openBoard(page, '#bandwidth-versus-noise');
    await expect(page.getByTestId('reader-title')).toHaveText('Bandwidth versus noise');
  });

  test('expanding a card makes room, the chip counts, collapse all clears', async ({ page }) => {
    await openBoard(page);
    await page.locator(card('the-nonlinear-dob') + ' .tog').click();
    await expect(page.getByTestId('chip')).toHaveText('1 expanded');
    await expect(page.locator(card('the-nonlinear-dob') + ' .card')).toHaveClass(/expanded/);
    await expect(page.locator(card('the-nonlinear-dob') + ' .katex').first()).toBeVisible();
    await page.waitForTimeout(700);
    expect(await overlaps(page)).toEqual([]);
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(450);
    for (const id of ['why-a-disturbance-observer-at-all', 'choosing-the-observer-gain', 'bandwidth-versus-noise', 'what-slowly-varying-costs', 'where-the-estimate-enters-the-loop', 'implementation-on-a-real-joint']) {
      await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(400);
      await page.locator(card(id) + ' .tog').click(); await page.waitForTimeout(400);
    }
    await expect(page.getByTestId('chip')).toHaveText('7 expanded');
    await expect(page.getByTestId('chip')).toHaveClass(/over/);
    await page.getByRole('button', { name: 'Collapse all' }).first().click();
    await expect(page.getByTestId('chip')).toHaveText('0 expanded');
    await page.waitForTimeout(600);
    expect(await overlaps(page)).toEqual([]);
  });

  test('arrows can be hidden, restored, drawn and removed', async ({ page }) => {
    await openBoard(page);
    const n0 = await page.locator('.react-flow__edge.edge-h').count();
    const mid = (await edgeMidpoint(page, '.react-flow__edge.edge-h'))!;
    await page.mouse.click(mid.x, mid.y);
    await expect(page.locator('.react-flow__edge.edge-h')).toHaveCount(n0 - 1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.react-flow__edge.edge-h')).toHaveCount(n0);
    const src = await page.locator(card('implementation-on-a-real-joint') + ' .react-flow__handle.source').boundingBox();
    const dst = await page.locator(card('interactive-simulation') + ' .card-head').boundingBox();
    await page.mouse.move(src!.x + src!.width / 2, src!.y + src!.height / 2); await page.mouse.down();
    await page.mouse.move(dst!.x + 10, dst!.y + 10, { steps: 10 }); await page.mouse.up();
    await expect(page.locator('.react-flow__edge.edge-user')).toHaveCount(1);
    const um = (await edgeMidpoint(page, '.react-flow__edge.edge-user'))!;
    await page.mouse.click(um.x, um.y);
    await expect(page.locator('.react-flow__edge.edge-user')).toHaveCount(0);
  });

  test('dragging a card moves it; the middle button pans, a left-drag on the background does not', async ({ page }) => {
    await openBoard(page);
    const hb = (await page.locator(card('why-a-disturbance-observer-at-all') + ' .card-head').boundingBox())!;
    const before = await page.locator(card('why-a-disturbance-observer-at-all')).evaluate(el => el.style.transform);
    await page.mouse.move(hb.x + 40, hb.y + 10); await page.mouse.down(); await page.mouse.move(hb.x + 40, hb.y + 140, { steps: 8 }); await page.mouse.up();
    const after = await page.locator(card('why-a-disturbance-observer-at-all')).evaluate(el => el.style.transform);
    expect(after).not.toBe(before);
    await page.mouse.move(hb.x + 300, hb.y + 300, { steps: 4 });
    expect(await page.locator(card('why-a-disturbance-observer-at-all')).evaluate(el => el.style.transform)).toBe(after);
    const vp0 = await page.locator('.react-flow__viewport').evaluate(el => el.style.transform);
    const bg = await bgPoint(page);
    await page.mouse.move(bg.x, bg.y); await page.mouse.down(); await page.mouse.move(bg.x + 60, bg.y - 40, { steps: 6 }); await page.mouse.up();
    expect(await page.locator('.react-flow__viewport').evaluate(el => el.style.transform)).toBe(vp0);
    await page.mouse.move(bg.x, bg.y); await page.mouse.down({ button: 'middle' }); await page.mouse.move(bg.x + 60, bg.y - 40, { steps: 6 }); await page.mouse.up({ button: 'middle' });
    expect(await page.locator('.react-flow__viewport').evaluate(el => el.style.transform)).not.toBe(vp0);
    // the middle button also pans from over a card, without moving the card or opening it
    const body = (await page.locator(card('the-nonlinear-dob') + ' .card-body').boundingBox())!;
    const vp1 = await page.locator('.react-flow__viewport').evaluate(el => el.style.transform);
    const p1 = await page.locator(card('the-nonlinear-dob')).evaluate(el => el.style.transform);
    await page.mouse.move(body.x + 40, body.y + 20); await page.mouse.down({ button: 'middle' }); await page.mouse.move(body.x + 140, body.y + 90, { steps: 6 }); await page.mouse.up({ button: 'middle' });
    expect(await page.locator('.react-flow__viewport').evaluate(el => el.style.transform)).not.toBe(vp1);
    expect(await page.locator(card('the-nonlinear-dob')).evaluate(el => el.style.transform)).toBe(p1);
    await expect(page.getByTestId('reader-title')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tidy' }).click(); await page.waitForTimeout(800);
    expect(await overlaps(page)).toEqual([]);
  });

  test('highlights paint, list, drag onto the board and survive a reload', async ({ page }) => {
    await openBoard(page, '#the-nonlinear-dob');
    await expect(page.getByTestId('reader-title')).toHaveText('The nonlinear DOB');
    await selectInReader(page, 4, 70);
    await expect(page.getByTestId('pop')).toBeVisible();
    await expect(page.getByTestId('pop').locator('button')).toHaveText(['Highlight', 'Highlight + note', '⠿ Drag to board']);
    await page.getByTestId('pop').getByRole('button', { name: 'Highlight', exact: true }).click();
    expect(await highlightCount(page)).toBe(1);
    await expect(page.getByTestId('note-count')).toHaveText('1');
    // click the highlight → its menu, then close it from outside
    const hc = (await highlightCenter(page))!;
    await page.mouse.click(hc.x, hc.y);
    await expect(page.getByTestId('pop').locator('button')).toHaveText(['Add note', '⠿ Drag to board', 'Remove']);
    const bg = await bgPoint(page); await page.mouse.click(bg.x, bg.y);
    await expect(page.getByTestId('pop')).toHaveCount(0);
    // drag the highlight itself onto the board
    await page.mouse.move(hc.x, hc.y); await page.mouse.down(); await page.mouse.move(hc.x - 60, hc.y, { steps: 4 });
    await expect(page.locator('.ghost')).toBeVisible();
    await page.mouse.move(bg.x, bg.y, { steps: 10 }); await page.mouse.up();
    await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge.edge-note')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(await overlaps(page)).toEqual([]);
    // note editor via "Highlight + note"
    await selectInReader(page, 80, 120);
    await page.getByTestId('pop').getByRole('button', { name: 'Highlight + note' }).click();
    await page.getByLabel('Note text').fill('check the sign of L');
    await page.getByRole('button', { name: 'Save note' }).click();
    await page.getByTestId('tab-notes').click();
    await expect(page.getByTestId('notes-list')).toContainText('check the sign of L');
    // persistence across a reload
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator('.react-flow__node-card')).toHaveCount(CARD_COUNT);
    await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
    await expect(page.getByTestId('note-count')).toHaveText('2');
    await page.getByTestId('toc').locator('a[data-id="the-nonlinear-dob"]').click();
    await expect.poll(() => highlightCount(page)).toBe(2);
    // remove one highlight through its menu
    const hc2 = (await highlightCenter(page))!;
    await page.mouse.click(hc2.x, hc2.y);
    await page.getByTestId('pop').getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);
  });

  test('note cards drag and release, reset keeps them', async ({ page }) => {
    await openBoard(page, '#the-nonlinear-dob');
    await selectInReader(page, 4, 60);
    await page.getByTestId('pop').getByRole('button', { name: '⠿ Drag to board' }).click();
    await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
    await page.waitForTimeout(500);
    const nb = (await page.locator('.react-flow__node-note .card-head').boundingBox())!;
    const q0 = await page.locator('.react-flow__node-note').evaluate(el => el.style.transform);
    await page.mouse.move(nb.x + 30, nb.y + 8); await page.mouse.down(); await page.mouse.move(nb.x + 150, nb.y + 90, { steps: 8 }); await page.mouse.up();
    const q1 = await page.locator('.react-flow__node-note').evaluate(el => el.style.transform);
    expect(q1).not.toBe(q0);
    await page.mouse.move(nb.x + 400, nb.y + 300, { steps: 4 });
    expect(await page.locator('.react-flow__node-note').evaluate(el => el.style.transform)).toBe(q1);
    await page.getByRole('button', { name: 'Reset board' }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
    await expect(page.getByTestId('chip')).toHaveText('0 expanded');
    expect(await overlaps(page, isCardId)).toEqual([]);
  });

  test('theme toggle sticks across pages and reloads', async ({ page }) => {
    await openBoard(page);
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    await page.getByTestId('theme').click();
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator('.react-flow__node-card')).toHaveCount(CARD_COUNT);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(after);
    await page.goto('');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(after);
    await page.locator('[data-theme-toggle]').click();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(before);
  });

  test('the simulation runs in an expanded card and pauses off screen', async ({ page }) => {
    await openBoard(page);
    await page.getByTestId('toc').locator('a[data-id="interactive-simulation"]').click();
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(450);
    await page.locator(card('interactive-simulation') + ' .tog').click();
    const st = page.locator(card('interactive-simulation') + ' .widget .st');
    await expect(st).toHaveText('● live');
    const snap = () => page.locator(card('interactive-simulation') + ' .widget canvas').evaluate(c => (c as HTMLCanvasElement).toDataURL().slice(-80));
    const a = await snap(); await page.waitForTimeout(400); expect(await snap()).not.toBe(a);
    await page.locator(card('interactive-simulation') + ' .widget').getByRole('button', { name: 'Pause' }).click();
    await expect(st).toHaveText('○ paused');
    await page.locator(card('interactive-simulation') + ' .widget').getByRole('button', { name: 'Run' }).click();
    await page.evaluate(() => { (document.querySelector('.react-flow__viewport') as HTMLElement).style.transform = 'translate(-6000px,-6000px) scale(1)'; });
    await expect(st).toHaveText('○ off screen, paused');
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(450);
    await expect(st).toHaveText('● live');
    await page.locator(card('interactive-simulation') + ' .tog').click();
    await expect(page.locator(card('interactive-simulation') + ' .widget')).toHaveCount(0);
  });

  test('fold preview and reader controls', async ({ page }) => {
    await openBoard(page, '#the-nonlinear-dob');
    await page.getByTestId('fold-sim').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-mode', 'fold');
    await expect(page.locator('.hinge')).toBeVisible();
    await page.getByTestId('fold-sim').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-mode', 'desk');
    await page.getByRole('button', { name: 'Close reader' }).click();
    await expect(page.getByTestId('reader')).toBeHidden();
    await page.getByTestId('rd-toggle').click();
    await expect(page.getByTestId('reader')).toBeVisible();
    await page.getByTestId('sb-toggle').click();
    await expect(page.getByTestId('sidebar')).toBeHidden();
    await page.getByTestId('sb-toggle').click();
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });
});
