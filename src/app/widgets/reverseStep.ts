/* One reverse step of a 1-D diffusion model, computed exactly.
   The data distribution is a mixture of normals, so every marginal q(z_{t-1}) is a mixture of normals too
   and the true reverse distribution q(z_{t-1} | z_t) can be evaluated on a grid with Bayes' rule.
   No DOM here, so the widget and scripts/check-reverse-step.mjs run the same code. */

export interface Comp { w: number; mu: number; s: number }
/** The "data": three narrow clusters. */
export const DATA: Comp[] = [{ w: 0.35, mu: -1.3, s: 0.12 }, { w: 0.4, mu: 0.2, s: 0.2 }, { w: 0.25, mu: 1.5, s: 0.1 }];

export const normal = (x: number, mean: number, variance: number) => Math.exp(-((x - mean) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);

/** q(z_{t-1}) when a fraction `noise` = 1 − α_{t-1} of the variance is already noise: each cluster is shrunk by √α and blurred. */
export function prior(z: number, noise: number): number {
  const a = 1 - noise; let p = 0;
  for (const c of DATA) p += c.w * normal(z, Math.sqrt(a) * c.mu, a * c.s * c.s + noise);
  return p;
}
/** Slope of log q(z_{t-1}), also called the score. */
export function score(z: number, noise: number): number {
  const a = 1 - noise; let p = 0, dp = 0;
  for (const c of DATA) { const m = Math.sqrt(a) * c.mu, v = a * c.s * c.s + noise, n = c.w * normal(z, m, v); p += n; dp += -n * (z - m) / v; }
  return dp / p;
}
/** q(z_t | z_{t-1}) read as a function of z_{t-1}: a bump centred at z_t/√(1−β) with variance β/(1−β). */
export const likelihood = (z: number, zt: number, beta: number) => normal(zt, Math.sqrt(1 - beta) * z, beta);
export const windowOf = (zt: number, beta: number) => ({ centre: zt / Math.sqrt(1 - beta), sd: Math.sqrt(beta / (1 - beta)) });

export interface Reverse {
  z: Float64Array; post: Float64Array; fit: Float64Array;
  /** Mean and standard deviation of the true reverse distribution. */
  mean: number; sd: number;
  /** Half the area between the true curve and the normal with the same mean and sd: 0 = identical, 1 = no overlap. */
  mismatch: number;
  /** What the straight-line argument predicts: mean = centre + sd² · score, sd = window sd. */
  predMean: number; predSd: number;
  /** The part of the axis that holds the distribution, for plotting. */
  view: [number, number];
}

export const X_MAX = 5;
/** The true reverse distribution q(z_{t-1} | z_t) on a grid, and the normal that best matches it.
    The grid reaches far into the tails of the window: with sharp data the product can sit there. */
export function reverse(zt: number, beta: number, noise: number, n = 2401, reach = 12): Reverse {
  const { centre, sd: ws } = windowOf(zt, beta);
  const lo = Math.max(-X_MAX, centre - reach * ws), hi = Math.min(X_MAX, centre + reach * ws), h = (hi - lo) / (n - 1);
  const z = new Float64Array(n), post = new Float64Array(n), fit = new Float64Array(n);
  let area = 0;
  for (let i = 0; i < n; i++) { z[i] = lo + i * h; post[i] = prior(z[i], noise) * likelihood(z[i], zt, beta); area += post[i] * h; }
  let mean = 0, second = 0;
  for (let i = 0; i < n; i++) { post[i] /= area; mean += z[i] * post[i] * h; }
  for (let i = 0; i < n; i++) second += (z[i] - mean) ** 2 * post[i] * h;
  let diff = 0;
  for (let i = 0; i < n; i++) { fit[i] = normal(z[i], mean, second); diff += Math.abs(post[i] - fit[i]) * h; }
  const sd = Math.sqrt(second), view: [number, number] = [Math.max(lo, mean - 4.5 * sd), Math.min(hi, mean + 4.5 * sd)];
  return { z, post, fit, mean, sd, view, mismatch: diff / 2, predMean: centre + ws * ws * score(centre, noise), predSd: ws };
}
