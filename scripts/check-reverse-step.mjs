// Reproduces the numbers quoted in src/content/posts/diffusion-small-steps.md from the same model the widget runs.
// Usage: node scripts/check-reverse-step.mjs      (Node 22.18 or newer, which loads the .ts file directly)
import * as R from '../src/app/widgets/reverseStep.ts';

const ZT = -0.5, NOISE = 0.1;
console.log(`observed z_t = ${ZT}, noise already in z_{t-1} = ${NOISE}`);
const rows = {};
for (const beta of [0.5, 0.2, 0.05, 0.02, 0.005, 0.001]) {
  const r = R.reverse(ZT, beta, NOISE), w = R.windowOf(ZT, beta);
  rows[`beta = ${beta}`] = { 'window sd': w.sd.toFixed(3), 'mismatch %': (100 * r.mismatch).toFixed(1), 'true mean': r.mean.toFixed(4), 'ramp mean': r.predMean.toFixed(4), 'true sd': r.sd.toFixed(4), 'ramp sd': r.predSd.toFixed(4) };
}
console.table(rows);

console.log('\nsame step size beta = 0.02, different amounts of noise already added');
const rows2 = {};
for (const noise of [0, 0.02, 0.1, 0.5, 0.9]) {
  let worst = 0;
  for (let zt = -2.5; zt <= 2.5; zt += 0.05) worst = Math.max(worst, R.reverse(zt, 0.02, noise).mismatch);
  rows2[`noise = ${noise}`] = { 'worst mismatch % over z_t': (100 * worst).toFixed(1) };
}
console.table(rows2);
