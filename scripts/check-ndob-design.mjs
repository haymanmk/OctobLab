// Reproduces the numbers quoted in src/content/posts/ndob-design.md from the same model the widget runs.
// Usage: node scripts/check-ndob-design.mjs      (Node 22.18 or newer, which loads the .ts file directly)
import * as S from '../src/app/widgets/gearedArm.ts';

const Q2DOT_MAX = 1.5;
function run({ beta = 20, ratio = 0.9, cog = 1, sigma = 0, dob = true, seconds = 32 }) {
  const { y } = S.design(beta, Q2DOT_MAX), arm = S.freshArm();
  const hold = [0, 0], peak = [0, 0], cruise = [0, 0]; let nh = 0, nc = 0, t = 0;
  for (let k = 0; k < seconds / S.TICK; k++) {
    S.tick(arm, t, { y, gravityRatio: ratio, cogAmp: cog, useDob: dob }, [sigma * S.gauss(), sigma * S.gauss()]); t += S.TICK;
    if (t < S.CYCLE) continue;                                   // skip the first cycle
    const now = S.phase(t).dwell, lateHold = now && !S.phase(t + 0.75).dwell, justLeft = !now && S.phase(t - 0.5).dwell;
    const atSpeed = !now && !justLeft && !S.phase(t + 0.5).dwell;
    for (let i = 0; i < 2; i++) {
      const e = Math.abs(arm.err[i]) * 1e3;
      if (lateHold) hold[i] += e;                                // mean |error| over the last 0.75 s of each hold
      if (justLeft) peak[i] = Math.max(peak[i], e);              // largest error in the 0.5 s after a hold: the reversal
      if (atSpeed) cruise[i] += e * e;
    }
    if (lateHold) nh++; if (atSpeed) nc++;
  }
  return { hold: hold.map(e => (e / nh).toFixed(3)).join(' / '), peak: peak.map(e => e.toFixed(2)).join(' / '), cruise: cruise.map(e => Math.sqrt(e / nc).toFixed(2)).join(' / ') };
}

const d = S.design(20, Q2DOT_MAX), ev = S.eig(S.inertia(0));
console.log(`design  sigma2 = ${d.sigma2.toFixed(3)}  zeta = ${d.zeta.toFixed(3)}  y = ${d.y.toFixed(2)}  poles at q2 = 0: ${(d.y / ev.max).toFixed(1)} to ${(d.y / ev.min).toFixed(1)} rad/s`);
console.log(`sampling limit  y < 2 lambda_min / T = ${(2 * ev.min / S.TICK).toFixed(0)}`);
console.log('\nposition error in mrad, joint 1 / joint 2');
console.table({ 'no observer': run({ dob: false }), 'beta = 5': run({ beta: 5 }), 'beta = 20': run({ beta: 20 }), 'beta = 100': run({ beta: 100 }) });
