---
title: Designing a Nonlinear Disturbance Observer, Step by Step
description: The design method of Mohammadi et al. for any serial manipulator, worked through on a geared arm with a gravity offset, reversal friction and motor cogging, with a live simulation.
date: 2026-11-11
tags: [control, estimation, robot-joints]
split: h2
---

# Designing a Nonlinear Disturbance Observer, Step by Step

<!-- summary: A design recipe for the nonlinear disturbance observer that works for any serial arm: bound the inertia matrix, bound how fast it changes, pick a convergence rate, and one formula gives the gain. Worked on a geared arm with three real problems. -->

The [previous article](../ndob/) showed what a nonlinear disturbance observer (NDOB) does and how its single gain behaves on one joint. It left one question open: on a real arm with several coupled joints, *how do you choose the gain matrix so that the observer is guaranteed to converge?*

This article answers that with the method of Mohammadi, Tavakoli, Marquez and Hashemzadeh, "Nonlinear disturbance observer design for robotic manipulators" (Control Engineering Practice, 2013). Their result is a recipe: three numbers go in, one gain comes out, and the proof holds for any serial manipulator.

The recipe is worked here on a problem from the bench: a geared joint that does not hold its position exactly, jumps when it reverses, and carries motor cogging. The last card is a simulation of that arm with the designed observer.

## The problem: three disturbances on a geared joint

<!-- summary: A holding offset that moves with the gravity compensation ratio, an error at every reversal from friction, and cogging through the reducer. All three are torques the model does not contain. -->

Three symptoms, all visible in the position error:

- **An offset while holding.** The arm stops, and a steady error remains. Tuning the gravity compensation ratio makes it smaller, which says the gravity feedforward is slightly wrong. A fixed ratio is right at one pose and one payload only.
- **An error at reversal.** When a joint changes direction, friction changes sign. For a moment the controller pushes against a torque that has just flipped, and the error jumps.
- **Cogging.** The motor's magnets pull on the stator teeth, so the motor adds a torque that depends on rotor angle. Through a reducer of ratio $N$ it reaches the joint $N$ times larger and repeats $N$ times more often per joint turn.

None of these is a tuning mistake in the feedback loop. Each is a torque that acts on the joint and is missing from the model. A disturbance observer estimates the sum of all such torques and subtracts it, so the three symptoms become one design problem.

## What this paper changes

<!-- summary: Chen's observer needs a gain matrix that was only found for planar arms with revolute joints and an exact model. This method needs neither: any serial arm, any joint type, and a model that may be wrong. -->

The NDOB of Chen et al. (2000) has the right structure, but its design step is hard: you must find a function $p(q,\dot q)$ whose derivative matches $L\,M(q)\,\ddot q$, and prove that the resulting error dynamics are stable. Chen et al. solved this for a two-link planar arm, and Nikoobin and Haghighi (2009) for $n$-link planar arms. Both solutions use the explicit form of the inertia matrix of that class of robot, and both assume the model is exact.

Mohammadi et al. remove these limits with one choice of gain. The design then uses only properties that every serial manipulator has:

| | Chen (2000), Nikoobin (2009) | Mohammadi et al. (2013) |
|---|---|---|
| Robot | planar, revolute joints | any serial arm, revolute or prismatic |
| Model | exact $M$, $C$, $g$ | an estimate $\hat M$, $\hat N$ is enough |
| Gain | found by hand for each robot class | one formula, or one LMI |
| Guarantee | asymptotic or exponential, case by case | exponential rate you choose |

The older observers are special cases of the new one, and so is the classical linear DOB (constant diagonal $\hat M$, $\hat N = 0$).

## Step 1: lump everything into one disturbance

<!-- summary: Write the true dynamics, subtract the model you trust, and call the rest $\tau_d$. The model's inertia matrix $\hat M$ only has to be symmetric, positive definite, bounded, and bounded in its rate of change. -->

The true arm obeys

$$
M(q)\ddot q + N(q,\dot q) + F(\dot q) = \tau + \tau_{ext}, \qquad N = C(q,\dot q)\dot q + G(q)
$$
where $F$ is friction and $\tau_{ext}$ is every external torque. You do not know $M$ and $N$ exactly. You have estimates $\hat M$ and $\hat N$, with errors $\Delta M = M - \hat M$ and $\Delta N = N - \hat N$. Move everything unknown to the right side:

$$
\hat M(q)\ddot q + \hat N(q,\dot q) = \tau + \tau_d, \qquad \tau_d = \tau_{ext} - \Delta M\,\ddot q - \Delta N - F(\dot q)
$$
$\tau_d$ is the **lumped disturbance**. For the geared joint it contains exactly the three problems: the gravity mismatch sits in $\Delta N$, friction is $F$, and cogging is part of $\tau_{ext}$.

The method asks very little of $\hat M$:

- it is symmetric and positive definite, with $\hat M(q) \le \sigma_2 I$ over the workspace;
- its rate of change is bounded, $\lVert \dot{\hat M}(q) \rVert \le \zeta$.

Those two constants, $\sigma_2$ and $\zeta$, are the first two inputs of the design. A constant $\hat M$ is allowed, and then $\zeta = 0$.

## Step 2: the observer, without acceleration

<!-- summary: Keep Chen's structure, and choose $L = Y\hat M^{-1}$ with a constant matrix $Y$. Then $p$ is simply $Y\dot q$, for every robot. The design problem shrinks to choosing $Y$. -->

The observer has an internal state $z$ and an output $\hat\tau_d$:

$$
\dot z = -L\,z + L\left[\hat N(q,\dot q) - \tau - p\right], \qquad \hat\tau_d = z + p
$$
The auxiliary vector $p$ must satisfy $\dot p = L\,\hat M(q)\,\ddot q$. That condition is what makes the acceleration cancel, and it is also what made the design hard: for a general $L$ there may be no such $p$.

The paper's choice is

$$
L(q) = Y\,\hat M^{-1}(q), \qquad p(\dot q) = Y\,\dot q
$$
with a *constant* invertible matrix $Y$. Check it: $\dot p = Y\ddot q = Y\hat M^{-1}\hat M\ddot q = L\hat M\ddot q$. It works for any $\hat M$, so no property of a particular robot is needed. With $\Delta\tau_d = \tau_d - \hat\tau_d$, the estimation error obeys

$$
\Delta\dot\tau_d = \dot\tau_d - Y\hat M^{-1}(q)\,\Delta\tau_d
$$
The inertia matrix now appears inside the gain. A heavy configuration gets a smaller $L$, a light one a larger $L$, automatically.

## Step 3: one inequality decides stability

<!-- summary: With the Lyapunov function $(X\Delta\tau_d)^T \hat M (X\Delta\tau_d)$, the error decays exponentially if $X + X^T - X^T \dot{\hat M} X \ge \Gamma$. The rate is $\lambda_{min}(\Gamma) / (2\sigma_2\lVert X\rVert^2)$. -->

Because $L$ changes with $q$, positive eigenvalues at each instant are not a proof. The paper uses the Lyapunov function

$$
W = (X\Delta\tau_d)^T\,\hat M(q)\,(X\Delta\tau_d), \qquad X = Y^{-1}
$$
For a slowly varying disturbance ($\dot\tau_d \approx 0$), its derivative is

$$
\dot W = -\Delta\tau_d^T\left[X + X^T - X^T\,\dot{\hat M}(q)\,X\right]\Delta\tau_d
$$
The bracket holds the whole design. The term $X + X^T$ is the gain pulling the error down. The term with $\dot{\hat M}$ is the price of a moving arm: when the inertia matrix changes, $W$ changes even if the error does not.

**Theorem 1 of the paper.** If $X$ is invertible and there is a positive definite $\Gamma$ with

$$
X + X^T - X^T\,\dot{\hat M}(q)\,X \ge \Gamma
$$
then the error converges to zero exponentially from any start, at a rate of at least

$$
\frac{\lambda_{min}(\Gamma)}{2\,\sigma_2\,\lVert X\rVert^2}
$$
So designing the observer means finding a constant matrix that satisfies one inequality.

## Step 4: solve it with one formula

Multiply the inequality by $Y^T$ and $Y$ and replace $\dot{\hat M}$ by its bound $\zeta I$. The result, $Y + Y^T - \zeta I - Y^T\Gamma Y \ge 0$, is a linear matrix inequality after a Schur complement:

$$
\begin{bmatrix} Y + Y^T - \zeta I & Y^T \\ Y & \Gamma^{-1} \end{bmatrix} \ge 0
$$
An LMI solver can search for $Y$, and you can add $Y \le \nu I$ to cap the gain. For most arms you do not need the solver. Take $Y = yI$ and ask for a minimum rate $\beta$. Then $\Gamma = \gamma I$ with $\gamma = 2\beta\sigma_2/y^2$, and the LMI collapses to a scalar condition:

<!-- preview -->

$$
y \ge \tfrac12\zeta + \beta\,\sigma_2
$$

<!-- /preview -->

Larger $y$ means more sensor noise in the estimate (next cards), so take equality:

$$
Y = \left(\tfrac12\zeta + \beta\,\sigma_2\right) I, \qquad L(q) = Y\hat M^{-1}(q), \qquad p = Y\dot q
$$

<!-- preview -->

That is the whole design. The three inputs are $\sigma_2$ (how heavy the arm can be), $\zeta$ (how fast its inertia can change) and $\beta$ (how fast you want the estimate).

<!-- /preview -->

## The recipe on our arm

<!-- summary: For the two-joint geared arm: $\sigma_2 = 1.36\ \mathrm{kg\,m^2}$, $\zeta = 0.48$ at 1.5 rad/s, and $\beta = 20$ rad/s give $y = 27.5$. The error poles then lie between 20 and 83 rad/s. -->

The simulated arm has two geared revolute joints in a vertical plane. With $c_2 = \cos q_2$, its inertia matrix is

$$
M(q) = \begin{bmatrix} a + 2b\,c_2 + J_1 & d + b\,c_2 \\ d + b\,c_2 & d + J_2 \end{bmatrix}
$$
with $a = 0.555$, $b = 0.131$, $d = 0.076$ and reflected rotor inertias $J_1 = 0.5$, $J_2 = 0.3$ (all in $\mathrm{kg\,m^2}$).

1. **Bound the inertia.** The largest eigenvalue occurs at $c_2 = 1$: $\sigma_2 = 1.36$.
2. **Bound its rate.** $\dot M = -b\sin q_2\,\dot q_2\begin{bmatrix}2 & 1\\ 1 & 0\end{bmatrix}$, and that matrix has norm $1 + \sqrt2$. With a speed limit of $1.5$ rad/s on joint 2, $\zeta = (1+\sqrt2)\,b\,\dot q_{2,max} = 0.48$.
3. **Choose the rate.** $\beta = 20$ rad/s, a time constant of 50 ms.
4. **Compute the gain.** $y = 0.24 + 20 \times 1.36 = 27.5$.

The actual error poles are the eigenvalues of $y\,M^{-1}(q)$. At $q_2 = 0$ they are $20.2$ and $82.6$ rad/s. The slowest one sits just above $\beta$: the guarantee is tight in the heaviest direction and generous in the lightest. That spread is the ratio of the largest to the smallest eigenvalue of $M$, and you cannot remove it with $Y = yI$.

The same four steps reproduce the paper's SCARA example: $\sigma_2 = 15$, $\zeta = 5.8\,\dot q_{2,max}$, $\dot q_{2,max} = 2$ rad/s and $\beta = 6$ give $y = 95.8$, the value in the paper's Table 2.

## Slow and fast: which of the three problems it fixes

<!-- summary: A disturbance that changes at rate $\kappa$ leaves an error of about $\kappa/\beta$. The gravity offset is slow and vanishes. The friction flip is a step and decays at rate $\beta$. Cogging at speed is far too fast and stays. -->

Theorem 1 assumes $\dot\tau_d \approx 0$. Theorem 2 of the paper drops that: if $\lVert\dot\tau_d\rVert \le \kappa$, the error converges exponentially into a ball. With $Y = yI$ designed as above, its radius simplifies to

$$
\lVert\Delta\tau_d\rVert \le \frac{\kappa}{\theta\,\beta}, \qquad 0 < \theta < 1
$$
and the rate into it is $(1-\theta)\beta$. So the question for each disturbance is how fast it changes compared with $\beta$.

- **Gravity mismatch** changes with the pose, at the speed of the motion. That is slow, so the estimate follows it and the holding offset goes away. The compensation ratio no longer needs to be exact.
- **Friction at reversal** is close to a step. The estimate cannot follow the jump itself, but it catches up at rate $\beta$ afterwards. The error spike becomes shorter and smaller as $\beta$ grows, and never disappears.
- **Cogging** depends on speed. At standstill it is a constant torque, and the observer cancels it completely. In motion it oscillates at $N_{cog}\,\dot q$ rad/s. The simulated joint has 600 cogging periods per turn, so at 0.64 rad/s the ripple is at 384 rad/s, and $\kappa \approx 384$ N·m/s for a 1 N·m amplitude. The bound $\kappa/\beta$ is then larger than the cogging itself. The theorem promises nothing here, and the simulation agrees.

Cogging in motion needs a different tool: a position-indexed table or a harmonic observer. The NDOB still removes what cogging does to the *hold*.

## Implementation notes

<!-- summary: Velocity noise reaches the estimate scaled by $y$. Integrate $z$ with backward Euler. Keep $y$ below $2\lambda_{min}(M)/T$, or the sampled loop goes unstable. Start $z$ at $-p$. -->

- **Noise.** $\hat\tau_d = z + y\,\dot q_m$, so velocity noise of standard deviation $\sigma$ appears in the torque with about $y\,\sigma$. In the simulation, $\sigma = 0.005$ rad/s gives 0.15 N·m at $\beta = 20$ and 0.70 N·m at $\beta = 100$. This is the cost side of $\beta$.
- **Integrating $z$.** Forward Euler needs $T\,y/\lambda_{min}(\hat M) < 2$. Backward Euler has no such limit and costs one linear solve: $(\hat M + T y I)\,z_{k+1} = \hat M z_k + T y\,(\hat N - \tau - p)$.
- **Sampling limit.** The term $-y\,\dot q_m$ in the torque is a velocity feedback through the plant. With a sample time $T$ it goes unstable near $y = 2\lambda_{min}(M)/T$. For this arm at 1 kHz that is $y \approx 665$; the simulation is stable at $y = 409$ and diverges at $y = 681$. The paper's analysis is in continuous time and does not show this limit.
- **Start-up.** Set $z_0 = -p(\dot q_0)$ so that the first estimate is zero.

One tick of the controller and observer:

```python
def tick(q, qd_meas, z, ref, y, T):
    M_hat = inertia(q)                                  # model of M(q)
    N_hat = coriolis(q, qd_meas) + ratio * gravity(q)   # model of C q̇ + G
    p     = y * qd_meas                                 # p = Y q̇
    d_hat = z + p                                       # disturbance estimate
    acc   = ref.qdd + KV * (ref.qd - qd_meas) + KP * (ref.q - q)
    tau   = M_hat @ acc + N_hat - d_hat                 # computed torque minus the estimate
    # backward Euler step of  ż = −L z + L (N̂ − τ − p),  L = y M̂⁻¹
    z = np.linalg.solve(M_hat + T * y * np.eye(len(q)),
                        M_hat @ z + T * y * (N_hat - tau - p))
    return tau, z
```

## Interactive simulation

<!-- summary: The geared arm moves out, holds, moves back and holds. Change the convergence rate, the gravity compensation ratio, the cogging amplitude and the noise, and compare the position error with and without the observer. -->

```widget
name: ndob-design-sim
beta: 20
ratio: 0.9
cogging: 1
noise: 0.002
```

The arm moves out for 2.5 s, holds for 1.5 s, moves back and holds again, so each joint reverses across every hold. A computed-torque controller ($K_p = 400$, $K_v = 40$) runs at 1 kHz. Its gravity term is scaled by the compensation ratio, and it knows nothing about friction or cogging. The upper plot shows the true lumped disturbance and the estimate. The lower plot shows the position error of the same arm with and without the observer. The shaded bands are the holds.

Four things to try:

1. **Move the gravity compensation ratio.** Without the observer the holding error follows it. With the observer it does not change.
2. **Set cogging to zero and the ratio to 1.00.** A holding error remains without the observer. That part is friction.
3. **Raise $\beta$.** The hold tightens and the reversal spike shrinks. Then raise the noise and watch the estimate thicken.
4. **Raise cogging to 4 N·m.** During motion the true disturbance oscillates and the estimate does not follow. During the hold it is flat and the estimate sits on it.

Measured on this model, without noise, at ratio 0.90 and 1 N·m cogging (joint 1 / joint 2, in mrad):

| | Holding error | Peak after reversal |
|---|---|---|
| No observer | 2.94 / 1.21 | 6.00 / 7.63 |
| $\beta = 5$ | 0.49 / 0.16 | 1.31 / 2.28 |
| $\beta = 20$ | 0.15 / 0.02 | 0.85 / 0.72 |
| $\beta = 100$ | 0.003 / 0.001 | 0.29 / 0.40 |

The error while moving at speed improves much less: 0.57 mrad RMS on joint 1 at $\beta = 20$ and 0.51 at $\beta = 100$. What is left there is mostly cogging.

## What the simulation leaves out

<!-- summary: The parameters are placeholders, static friction is smoothed, the reducer is rigid, and the inertia model is exact. Each one matters on the real joint. -->

The numbers above come from a model, and the model is kind in four ways.

- **The parameters are placeholders.** Masses, friction levels, the 600 cogging periods and the 1 N·m amplitude are plausible values for a small arm, not measurements. Replace them before trusting any millirad.
- **Static friction is smoothed.** The sign function is rounded near zero speed, so the simulated joint creeps to the target. A real joint can stick, and an observer then behaves like integral action: it can make the joint hunt around the target. Test for this on hardware at high $\beta$.
- **The reducer is rigid.** A harmonic drive has compliance. Its resonance limits $y$ before the sampling limit does.
- **The inertia model is exact.** With $\hat M \ne M$ the lumped disturbance contains $-\Delta M\,\ddot q$, which depends on the torque and therefore on the estimate. The paper treats that term as part of a slow disturbance. To be safe, choose $\sigma_2$ as a bound on the true inertia, not on an optimistic estimate.

**Reference.** A. Mohammadi, M. Tavakoli, H. J. Marquez, F. Hashemzadeh, "Nonlinear disturbance observer design for robotic manipulators," *Control Engineering Practice*, vol. 21, no. 3, pp. 253–267, 2013. Earlier work: W.-H. Chen, D. J. Ballance, P. J. Gawthrop, J. O'Reilly, "A nonlinear disturbance observer for robotic manipulators," *IEEE Trans. Industrial Electronics*, vol. 47, no. 4, 2000.
