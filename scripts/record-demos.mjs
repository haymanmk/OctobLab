/**
 * Records the three "How it reads" demos from the built site and writes
 * public/media/<name>.{gif,webm,png}. Run `npm run build` first; this starts
 * `astro preview` itself unless DEMO_BASE points at a running server.
 */
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const W = 1100, H = 640, FPS = 10, SCALE = 1; // frames are captured at W*SCALE x H*SCALE
const OUT = path.resolve('public/media');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ensureServer() {
  if (process.env.DEMO_BASE) return { base: process.env.DEMO_BASE, stop: () => {} };
  const base = 'http://127.0.0.1:4321/OctobLab/';
  const proc = spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', '4321'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(base); if (r.ok) break; } catch {} await sleep(500); }
  return { base, stop: () => proc.kill() };
}

const CURSOR = `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg"><path d="M2 2l7 22 3.5-8.5L21 12z" fill="#1a1e27" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

async function installCursor(page) {
  await page.addStyleTag({ content: `#__cur{position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transition:none}#__cur.down{filter:drop-shadow(0 0 5px rgba(43,75,211,.9))}#__ring{position:fixed;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border:2px solid #2b4bd3;border-radius:50%;z-index:99998;pointer-events:none;opacity:0}#__ring.on{animation:__pulse .45s ease-out}@keyframes __pulse{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(1.5)}}` });
  await page.evaluate(svg => { const c = document.createElement('div'); c.id = '__cur'; c.innerHTML = svg; document.body.append(c); const r = document.createElement('div'); r.id = '__ring'; document.body.append(r); }, CURSOR);
}

class Pointer {
  constructor(page) { this.page = page; this.x = 0; this.y = 0; }
  async place(x, y) { await this.page.mouse.move(x, y); await this.page.evaluate(([x, y]) => { document.getElementById('__cur').style.transform = `translate(${x - 2}px,${y - 2}px)`; const r = document.getElementById('__ring'); r.style.left = x + 'px'; r.style.top = y + 'px'; }, [x, y]); this.x = x; this.y = y; }
  async move(x, y, steps = 14) { const sx = this.x, sy = this.y; for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; await this.place(sx + (x - sx) * e, sy + (y - sy) * e); await sleep(1000 / FPS / 2); } }
  async down(button = 'left') { await this.page.mouse.down({ button }); await this.page.evaluate(() => document.getElementById('__cur').classList.add('down')); }
  async up(button = 'left') { await this.page.mouse.up({ button }); await this.page.evaluate(() => document.getElementById('__cur').classList.remove('down')); }
  async click(x, y) { await this.move(x, y); await this.page.evaluate(() => { const r = document.getElementById('__ring'); r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }); await this.down(); await sleep(60); await this.up(); }
  async drag(from, to, button = 'left', steps = 16) { await this.move(from.x, from.y); await this.down(button); await sleep(120); await this.move(to.x, to.y, steps); await sleep(120); await this.up(button); }
}

class Recorder {
  constructor(page) { this.page = page; this.frames = []; this.on = false; }
  start() { this.on = true; this.t0 = Date.now(); this.loop = (async () => { while (this.on) { const t = Date.now() - this.t0; const buf = await this.page.screenshot({ type: 'png' }); this.frames.push({ t, buf }); await sleep(15); } })(); }
  async stop() { this.on = false; await this.loop; }
  /** resample to a fixed frame rate */
  sampled() { const out = []; const end = this.frames[this.frames.length - 1].t; for (let t = 0; t <= end; t += 1000 / FPS) { let best = this.frames[0]; for (const f of this.frames) { if (Math.abs(f.t - t) < Math.abs(best.t - t)) best = f; } out.push(best.buf); } return out; }
}

const center = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const box = async (page, sel) => page.locator(sel).first().boundingBox();
const card = id => `.react-flow__node-card[data-id="${id}"]`;
const bgPoint = page => page.evaluate(() => { const pane = document.querySelector('.react-flow__pane').getBoundingClientRect(); for (let y = pane.bottom - 90; y > pane.top + 90; y -= 24) for (let x = pane.left + 40; x < pane.right - 40; x += 24) { const e = document.elementFromPoint(x, y); if (e && (e.classList.contains('react-flow__pane') || e.closest('.react-flow__background'))) return { x, y }; } return { x: pane.left + 60, y: pane.bottom - 60 }; });

async function session(browser, base, hash) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: 'light' });
  await ctx.addInitScript(() => { localStorage.setItem('octoblab.theme', '"light"'); localStorage.setItem('octoblab.readerW', '380'); localStorage.setItem('octoblab.input', '"mouse"'); localStorage.setItem('octoblab.helpSeen', 'true'); });
  const page = await ctx.newPage();
  await page.goto(base + 'posts/ndob/' + hash);
  await page.locator('.react-flow__node-card').nth(9).waitFor();
  await sleep(900);
  await installCursor(page);
  return { ctx, page, pointer: new Pointer(page), rec: new Recorder(page) };
}

const demos = {
  async contents(browser, base) {
    const { ctx, page, pointer, rec } = await session(browser, base, '#the-nonlinear-dob');
    await pointer.place(640, 420); rec.start(); await sleep(500);
    for (const [id, wait] of [['choosing-the-observer-gain', 1500], ['what-slowly-varying-costs', 1500], ['interactive-simulation', 1800]]) {
      const b = await box(page, `[data-testid="toc"] a[data-id="${id}"]`); await pointer.click(b.x + 40, b.y + b.height / 2); await sleep(wait);
    }
    await rec.stop(); await ctx.close(); return rec;
  },
  async board(browser, base) {
    const { ctx, page, pointer, rec } = await session(browser, base, '');
    await page.getByTestId('rd-toggle').click(); await sleep(200);
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await sleep(600);
    await pointer.place(760, 520); rec.start(); await sleep(500);
    let b = await box(page, card('the-nonlinear-dob') + ' .tog'); await pointer.click(...Object.values(center(b))); await sleep(1600);
    b = await box(page, card('choosing-the-observer-gain') + ' .card-head'); await pointer.drag({ x: b.x + 60, y: b.y + 12 }, { x: b.x + 230, y: b.y + 110 }); await sleep(900);
    const port = center(await box(page, card('implementation-on-a-real-joint') + ' .react-flow__handle.source'));
    const target = await box(page, card('interactive-simulation') + ' .card-head'); await pointer.drag(port, { x: target.x + 60, y: target.y + 30 }); await sleep(1600);
    await rec.stop(); await ctx.close(); return rec;
  },
  async reader(browser, base) {
    const { ctx, page, pointer, rec } = await session(browser, base, '#the-nonlinear-dob');
    await pointer.place(700, 420); rec.start(); await sleep(500);
    const sel = await page.evaluate(() => { const content = document.querySelector('.reader .content'); const p = [...content.querySelectorAll('p')].find(p => p.firstChild && p.firstChild.nodeType === 3 && p.firstChild.nodeValue.length > 60); const r = document.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, Math.min(58, p.firstChild.nodeValue.length)); const rs = r.getClientRects(); const a = rs[0], z = rs[rs.length - 1]; return { x1: a.left + 1, y1: a.top + a.height / 2, x2: z.right - 1, y2: z.top + z.height / 2 }; });
    await pointer.drag({ x: sel.x1, y: sel.y1 }, { x: sel.x2, y: sel.y2 }, 'left', 18); await sleep(700);
    let b = await box(page, '[data-testid="pop"] button'); await pointer.click(...Object.values(center(b))); await sleep(900);
    const hc = await page.evaluate(() => { const r = [...CSS.highlights.get('hl')][0]; const bb = r.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; });
    const drop = await bgPoint(page);
    await pointer.drag(hc, drop, 'left', 20); await sleep(1800);
    await rec.stop(); await ctx.close(); return rec;
  },
};

const decode = buf => { const png = PNG.sync.read(buf); return { width: png.width, height: png.height, rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) }; };

/** GIF with per-frame palettes and delta frames: pixels that did not change since the previous frame are transparent. */
function encodeGif(frames, file) {
  const gif = GIFEncoder(); let prev = null;
  for (const buf of frames) {
    const { width, height, rgba } = decode(buf);
    const palette = quantize(rgba, 95, { format: 'rgb444' });
    const index = applyPalette(rgba, palette, 'rgb444');
    if (prev) {
      palette.push([1, 254, 1]); const t = palette.length - 1;
      for (let i = 0, n = width * height; i < n; i++) { const o = i * 4; if (rgba[o] === prev[o] && rgba[o + 1] === prev[o + 1] && rgba[o + 2] === prev[o + 2]) index[i] = t; }
      gif.writeFrame(index, width, height, { palette, delay: Math.round(1000 / FPS), transparent: true, transparentIndex: t, dispose: 1 });
    } else gif.writeFrame(index, width, height, { palette, delay: Math.round(1000 / FPS), dispose: 1 });
    prev = rgba.slice();
  }
  gif.finish(); fs.writeFileSync(file, gif.bytes());
}

/** WebM through the ffmpeg that ships with Playwright: it decodes JPEG, so frames go in as a JPEG stream. */
function encodeWebm(frames, file) {
  const ff = fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('ffmpeg-')).map(d => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find(fs.existsSync) || process.env.FFMPEG || 'ffmpeg';
  return new Promise((resolve, reject) => {
    const p = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '800k', '-crf', '10', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-f', 'webm', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code)));
    for (const buf of frames) { const { width, height, rgba } = decode(buf); p.stdin.write(jpeg.encode({ data: Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length), width, height }, 92).data); }
    p.stdin.end();
  });
}

const only = process.argv.slice(2);
const { base, stop } = await ensureServer();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const metaFile = path.resolve('src/data/demos.json');
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
try {
  for (const name of Object.keys(demos)) {
    if (only.length && !only.includes(name)) continue;
    const rec = await demos[name](browser, base); const frames = rec.sampled();
    fs.writeFileSync(path.join(OUT, `${name}.png`), frames[0]);
    encodeGif(frames, path.join(OUT, `${name}.gif`));
    await encodeWebm(frames, path.join(OUT, `${name}.webm`));
    meta[name] = { frames: frames.length, seconds: +(frames.length / FPS).toFixed(1), width: Math.round(W * SCALE), height: Math.round(H * SCALE) };
    fs.mkdirSync(path.dirname(metaFile), { recursive: true }); fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
    console.log(name, frames.length, 'frames', (fs.statSync(path.join(OUT, `${name}.gif`)).size / 1e6).toFixed(2) + ' MB gif', (fs.statSync(path.join(OUT, `${name}.webm`)).size / 1e6).toFixed(2) + ' MB webm');
  }
} finally { await browser.close(); stop(); }
