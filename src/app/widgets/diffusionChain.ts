/* A whole 1-D diffusion chain on the three-cluster data of reverseStep.ts.
   Forward: z_t = √(1−β) z_{t−1} + √β ε, repeated until the noise variance 1 − (1−β)^t reaches 0.99.
   Reverse: the decoder of the article, z_{t−1} ~ N(f_t[z_t], β), with the ideal mean
   f_t[z_t] = (z_t + β · score_t(z_t)) / √(1−β) in place of a trained network.
   No DOM here. A fixed seed keeps the picture the same on every visit. */
import { DATA, score } from './reverseStep';

export interface Chain {
  T: number; beta: number;
  /** A few whole trajectories for drawing; index t is the value at step t. */
  fwd: Float32Array[]; rev: Float32Array[];
  /** Where every particle ends: z_T of the forward chain, and the generated samples of the reverse chain. */
  fwdEnd: Float32Array; revEnd: Float32Array;
}

/** Steps of size β until α_T = (1−β)^T ≤ 0.01: the noise variance is 0.99 and the data is scaled down to a tenth. */
export const stepsFor = (beta: number) => Math.ceil(Math.log(0.01) / Math.log(1 - beta));

function gaussian(seed: number) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, g };
}

export function chain(beta: number, particles = 400, paths = 40, seed = 7): Chain {
  const T = stepsFor(beta), shrink = Math.sqrt(1 - beta), jump = Math.sqrt(beta), { u, g } = gaussian(seed);
  /** Share of the variance of z_t that is noise. */
  const noise = new Float64Array(T + 1); for (let t = 1; t <= T; t++) noise[t] = 1 - (1 - noise[t - 1]) * (1 - beta);
  const fwd: Float32Array[] = [], rev: Float32Array[] = [], fwdEnd = new Float32Array(particles), revEnd = new Float32Array(particles);

  for (let i = 0; i < particles; i++) {
    let r = u(), k = 0; while (k < DATA.length - 1 && r > DATA[k].w) { r -= DATA[k].w; k++; }
    let z = DATA[k].mu + DATA[k].s * g();
    const keep = i < paths ? new Float32Array(T + 1) : null; if (keep) { keep[0] = z; fwd.push(keep); }
    for (let t = 1; t <= T; t++) { z = shrink * z + jump * g(); if (keep) keep[t] = z; }
    fwdEnd[i] = z;
  }
  for (let i = 0; i < particles; i++) {
    let z = g();
    const keep = i < paths ? new Float32Array(T + 1) : null; if (keep) { keep[T] = z; rev.push(keep); }
    // the last step lands on the data and adds no noise
    for (let t = T; t >= 1; t--) { z = (z + beta * score(z, noise[t])) / shrink + (t > 1 ? jump * g() : 0); if (keep) keep[t - 1] = z; }
    revEnd[i] = z;
  }
  return { T, beta, fwd, rev, fwdEnd, revEnd };
}

export interface PhotoFrames { fwd: Float32Array[]; rev: Float32Array[] }
/** The steps at which the photo is shown: `n` of them, evenly spaced from 0 to T. */
export const frameSteps = (T: number, n: number) => Array.from({ length: n }, (_, k) => Math.round(k / (n - 1) * T));

/** The same two chains on a photo. `x` holds every colour value scaled to −1…1, and each value is its own 1-D chain.
    Only the frames at `frameSteps` are kept. Between two of them the chain is not walked one step at a time:
    many steps of "scale, shift, add normal noise" collapse into one step of the same kind, with the same distribution.
    The reverse chain is the decoder of a model whose whole dataset is this one photo. Then q(z_t) = N(√α_t x, 1−α_t)
    exactly, its slope is −(z_t − √α_t x)/(1−α_t), and one reverse step is z_{t−1} = a_t z_t + b_t x + √β ε. */
export function photoFrames(x: Float32Array, beta: number, n: number, seed = 11): PhotoFrames {
  const T = stepsFor(beta), ts = frameSteps(T, n), shrink = Math.sqrt(1 - beta), { g } = gaussian(seed), len = x.length;
  const alpha = (t: number) => (1 - beta) ** t;
  const fwd: Float32Array[] = [x], rev: Float32Array[] = new Array(n);
  for (let k = 1; k < n; k++) {
    const r = alpha(ts[k]) / alpha(ts[k - 1]), a = Math.sqrt(r), s = Math.sqrt(1 - r), prev = fwd[k - 1], f = new Float32Array(len);
    for (let i = 0; i < len; i++) f[i] = a * prev[i] + s * g();
    fwd.push(f);
  }
  let z = new Float32Array(len); for (let i = 0; i < len; i++) z[i] = g();
  rev[n - 1] = z;
  for (let k = n - 1; k >= 1; k--) {
    // z_low = A · z_high + B · x + S · ε, built up from the single steps in between
    let A = 1, B = 0, S2 = 0;
    for (let t = ts[k]; t > ts[k - 1]; t--) {
      const al = alpha(t), a = (1 - beta / (1 - al)) / shrink, b = beta * Math.sqrt(al) / ((1 - al) * shrink);
      A *= a; B = a * B + b; S2 = a * a * S2 + (t > 1 ? beta : 0);
    }
    const S = Math.sqrt(S2), next = new Float32Array(len);
    for (let i = 0; i < len; i++) next[i] = A * z[i] + B * x[i] + S * g();
    rev[k - 1] = z = next;
  }
  return { fwd, rev };
}
