/* A two-joint geared arm moving in a vertical plane, with the three disturbances this article is about:
   a gravity compensation that is slightly off, joint friction that flips at every reversal, and motor
   cogging seen through the reducer. The observer is the one designed in Mohammadi, Tavakoli, Marquez and
   Hashemzadeh, "Nonlinear disturbance observer design for robotic manipulators" (Control Engineering
   Practice, 2013): structure (25), gain L = Y M̂⁻¹ (27), p = Y q̇ (28), and Y = yI from the rule (58).
   No DOM here, so the widget and scripts/check-ndob-design.mjs run the same code.
   Every number below is a placeholder for a small arm, not a measurement. */

export type Vec = [number, number];
export type Mat = [Vec, Vec];

export const G0 = 9.81;
const m1 = 4, m2 = 2.5, l1 = 0.35, lc1 = 0.175, lc2 = 0.15, I1 = 0.05, I2 = 0.02;
/** Rotor inertia seen at the joint: J_rotor · ratio². */
const JR: Vec = [0.5, 0.3];
export const A = I1 + I2 + m1 * lc1 * lc1 + m2 * (l1 * l1 + lc2 * lc2), B = m2 * l1 * lc2, D = I2 + m2 * lc2 * lc2;
/** Cogging periods per turn of the joint: slot-pole periods per motor turn (12) × reducer ratio (50). */
export const COG_PERIODS = 600;
const COG_SPLIT: Vec = [1, 0.5];
const FC: Vec = [1.2, 0.6], FS: Vec = [1.8, 0.9], FV: Vec = [0.8, 0.4], VS: Vec = [0.05, 0.05], SGN_EPS = 0.004;

export function inertia(q2: number): Mat { const c = Math.cos(q2); return [[A + 2 * B * c + JR[0], D + B * c], [D + B * c, D + JR[1]]]; }
export function coriolis(q: Vec, v: Vec): Vec { const h = B * Math.sin(q[1]); return [-h * (2 * v[0] * v[1] + v[1] * v[1]), h * v[0] * v[0]]; }
/** Joint angles are measured from the horizontal, so gravity is largest with the arm stretched out level. */
export function gravity(q: Vec): Vec { const g2 = m2 * lc2 * G0 * Math.cos(q[0] + q[1]); return [(m1 * lc1 + m2 * l1) * G0 * Math.cos(q[0]) + g2, g2]; }
/** Coulomb and static friction joined by the Stribeck curve, plus viscous. The sign is smoothed over ±SGN_EPS. */
export function friction(v: Vec): Vec {
  return [0, 1].map(i => { const e = Math.exp(-(v[i] * v[i]) / (VS[i] * VS[i])); return Math.tanh(v[i] / SGN_EPS) * (FC[i] * (1 - e) + FS[i] * e) + FV[i] * v[i]; }) as Vec;
}
/** Cogging depends on the rotor angle only, so at the joint it repeats COG_PERIODS times per turn. */
export function cogging(q: Vec, amp: number): Vec { return [amp * COG_SPLIT[0] * Math.sin(COG_PERIODS * q[0]), amp * COG_SPLIT[1] * Math.sin(COG_PERIODS * q[1] + 1)]; }

export function solve(M: Mat, b: Vec): Vec { const det = M[0][0] * M[1][1] - M[0][1] * M[1][0]; return [(M[1][1] * b[0] - M[0][1] * b[1]) / det, (M[0][0] * b[1] - M[1][0] * b[0]) / det]; }
export const mul = (M: Mat, x: Vec): Vec => [M[0][0] * x[0] + M[0][1] * x[1], M[1][0] * x[0] + M[1][1] * x[1]];
export function eig(M: Mat): { min: number; max: number } { const t = 0.5 * (M[0][0] + M[1][1]), r = Math.sqrt(0.25 * (M[0][0] - M[1][1]) ** 2 + M[0][1] * M[1][0]); return { min: t - r, max: t + r }; }

/* ---------- the design: three numbers in, one gain out ---------- */

export interface Design { sigma2: number; zeta: number; y: number; beta: number }
/** σ₂ bounds M̂(q) from above (17), ζ bounds ‖dM̂/dt‖ (18), and y = ζ/2 + β σ₂ is the analytical solution (58). */
export function design(beta: number, q2dotMax: number): Design {
  const sigma2 = eig(inertia(0)).max;                 // cos q₂ = 1 is the worst case
  const zeta = (1 + Math.SQRT2) * B * q2dotMax;       // dM/dt = −B sin q₂ · q̇₂ · [[2, 1], [1, 0]], whose norm is (1 + √2) B |sin q₂ q̇₂|
  return { sigma2, zeta, y: 0.5 * zeta + beta * sigma2, beta };
}

/* ---------- reference: out, hold, back, hold. The joint reverses across each hold. ---------- */

export const CYCLE = 8, MOVE = 2.5, DWELL = 1.5;
const Q_A: Vec = [0.3, 0.4], Q_B: Vec = [1.1, 1.3];
export function phase(t: number): { tc: number; dwell: boolean } { const tc = ((t % CYCLE) + CYCLE) % CYCLE; return { tc, dwell: (tc >= MOVE && tc < MOVE + DWELL) || tc >= 2 * MOVE + DWELL }; }
export function reference(t: number): { q: Vec; v: Vec; a: Vec } {
  const { tc } = phase(t); let s = 0, sd = 0, sdd = 0;
  const prof = (u: number) => { const w = 2 * Math.PI / MOVE; return [u / MOVE - Math.sin(w * u) / (2 * Math.PI), (1 - Math.cos(w * u)) / MOVE, w * Math.sin(w * u) / MOVE]; };
  if (tc < MOVE) [s, sd, sdd] = prof(tc);
  else if (tc < MOVE + DWELL) s = 1;
  else if (tc < 2 * MOVE + DWELL) { const [p, pd, pdd] = prof(tc - MOVE - DWELL); s = 1 - p; sd = -pd; sdd = -pdd; }
  const f = (k: number) => [0, 1].map(i => (Q_B[i] - Q_A[i]) * k) as Vec;
  return { q: [Q_A[0] + (Q_B[0] - Q_A[0]) * s, Q_A[1] + (Q_B[1] - Q_A[1]) * s], v: f(sd), a: f(sdd) };
}

/* ---------- one arm under computed-torque control, with or without the observer ---------- */

export const KP = 400, KV = 40, TICK = 0.001, SUBSTEPS = 4;
export interface Params { y: number; gravityRatio: number; cogAmp: number; useDob: boolean }
export interface Arm { q: Vec; v: Vec; z: Vec; dhat: Vec; d: Vec; err: Vec }
export function freshArm(): Arm { return { q: [...Q_A], v: [0, 0], z: [0, 0], dhat: [0, 0], d: [0, 0], err: [0, 0] }; }

/** One 1 kHz control tick: measure, estimate, command, then integrate the true plant over the tick.
 *  `noise` is this tick's error on each measured joint velocity. */
export function tick(arm: Arm, t: number, P: Params, noise: Vec): void {
  const ref = reference(t), vm: Vec = [arm.v[0] + noise[0], arm.v[1] + noise[1]];
  // What the controller believes: the inertia matrix, Coriolis terms, and gravity scaled by the compensation ratio.
  const Mh = inertia(arm.q[1]), Cq = coriolis(arm.q, vm), Gq = gravity(arm.q);
  const Nh: Vec = [Cq[0] + P.gravityRatio * Gq[0], Cq[1] + P.gravityRatio * Gq[1]];
  const p: Vec = [P.y * vm[0], P.y * vm[1]];                                   // p = Y q̇                (28)
  const dhat: Vec = [arm.z[0] + p[0], arm.z[1] + p[1]];                        // τ̂_d = z + p            (25)
  const acc: Vec = [0, 1].map(i => ref.a[i] + KV * (ref.v[i] - vm[i]) + KP * (ref.q[i] - arm.q[i])) as Vec;
  const u = mul(Mh, acc);
  const tau: Vec = [0, 1].map(i => u[i] + Nh[i] - (P.useDob ? dhat[i] : 0)) as Vec;   // computed torque (62) minus the estimate
  // ż = −L z + L (N̂ − τ − p) with L = y M̂⁻¹                                   (25), (27)
  // Backward Euler: (M̂ + T y I) z⁺ = M̂ z + T y (N̂ − τ − p).
  const Mz = mul(Mh, arm.z), h = TICK * P.y;
  arm.z = solve([[Mh[0][0] + h, Mh[0][1]], [Mh[1][0], Mh[1][1] + h]], [Mz[0] + h * (Nh[0] - tau[0] - p[0]), Mz[1] + h * (Nh[1] - tau[1] - p[1])]);
  arm.dhat = dhat;
  let first: Vec = [0, 0]; const dt = TICK / SUBSTEPS;
  for (let k = 0; k < SUBSTEPS; k++) {
    const C = coriolis(arm.q, arm.v), G = gravity(arm.q), F = friction(arm.v), cg = cogging(arm.q, P.cogAmp);
    const dist: Vec = [(P.gravityRatio - 1) * G[0] - F[0] + cg[0], (P.gravityRatio - 1) * G[1] - F[1] + cg[1]];
    if (k === 0) first = dist;
    const qdd = solve(inertia(arm.q[1]), [tau[0] - C[0] - P.gravityRatio * G[0] + dist[0], tau[1] - C[1] - P.gravityRatio * G[1] + dist[1]]);
    for (let i = 0; i < 2; i++) { arm.v[i] += dt * qdd[i]; arm.q[i] += dt * arm.v[i]; }
  }
  arm.d = first;   // the lumped disturbance τ_d of (14): gravity mismatch − friction + cogging. Only the simulation knows it.
  arm.err = [ref.q[0] - arm.q[0], ref.q[1] - arm.q[1]];
}

export function gauss(): number { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }
