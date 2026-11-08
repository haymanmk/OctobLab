---
title: Nonlinear Disturbance Observer for Robot Control
description: From the linear DOB to Chen's nonlinear observer, with the tuning rules that matter on a real joint and a live simulation to push around.
date: 2026-11-08
tags: [control, estimation, robot-joints]
split: h2
---

# Nonlinear Disturbance Observer for Robot Control

<!-- summary: What a disturbance observer does for a robot joint, why the linear version falls short on real manipulators, and how to tune the nonlinear one on hardware. -->

A robot joint never sees the model you wrote down. Payloads change, friction drifts with temperature, cables pull, and the other joints push through the coupling terms you dropped. A *disturbance observer* (DOB) estimates the lumped effect of everything your model missed and cancels it in the torque command.

This article goes from the classical linear DOB to the nonlinear form of Chen et al. (2000), then to the tuning rules that matter on a real joint: how the observer gain trades estimation speed against sensor noise, what the “slowly varying” assumption costs, and where the estimate enters the loop. The last card is a live simulation you can push around.

Expand any card on the board to read it in place, or open it in the reader to highlight and annotate.

## Why a disturbance observer at all?

<!-- summary: High gain fights disturbances but amplifies noise, and integral action is slow and winds up. A DOB separates nominal control from disturbance rejection. -->

Take a single joint with inertia $J$ and viscous friction $b$:

$$J\ddot q + b\dot q = \tau + d$$

Here $d$ lumps everything the model does not describe: payload torque, friction mismatch, gravity error, coupling from other joints. The classical answers to $d$ each have a cost.

- **High-gain PD** suppresses $d$ in proportion to the gain, but it also amplifies encoder noise and excites the first structural resonance.
- **Integral action** removes steady offsets, but it is slow and winds up whenever the actuator saturates.
- **Inverse dynamics** computes $d = J\ddot q + b\dot q - \tau$ directly, but it needs acceleration, and differentiating an encoder twice is a noise generator.

A DOB splits the problem in two. A feedback controller handles the nominal plant, and an estimator reconstructs $d$ from signals you already have, then cancels it in the torque. The key idea: you do not need to know $d$. You need to know what the nominal model would have done without it.

## The linear DOB in one picture

<!-- summary: Invert the nominal plant, low-pass the result with Q(s), and subtract. The bandwidth of Q sets the trade between tracking speed and noise. -->

The classical observer compares what the plant did with what the nominal model $P_n(s)$ predicts for the same torque:

$$\hat d = Q(s)\left[P_n^{-1}(s)\,y - \tau\right]$$

$Q(s)$ is a low-pass filter, and its bandwidth is the one knob. Raise it and $\hat d$ follows fast changes in $d$, but sensor noise passes through $P_n^{-1}$, which is improper and amplifies high frequencies. Lower it and the estimate lags.

Two things break on a manipulator. First, $P_n^{-1}$ needs a *linear* nominal model, but the inertia matrix $M(q)$, the Coriolis terms and gravity all change with configuration, so a model linearised at one pose is wrong at another. Second, the relative degree of $Q$ must at least match that of $P_n$ for $Q P_n^{-1}$ to be realisable, which forces a second-order filter and extra lag. The nonlinear DOB removes both problems by working in state space instead of transfer functions.

## The nonlinear DOB

<!-- summary: Chen et al. build the estimate from an auxiliary state plus a function of velocity, so no acceleration is ever needed. The estimation error decays exponentially. -->

For the full rigid-body model

$$M(q)\ddot q + C(q,\dot q)\dot q + g(q) = \tau + d$$

Chen, Ballance, Gawthrop and O'Reilly (2000) proposed the observer

$$\hat d = z + p(q,\dot q), \qquad \dot z = -L\,z + L\left[C(q,\dot q)\dot q + g(q) - \tau - p(q,\dot q)\right]$$

with the design condition $\dfrac{\partial p}{\partial \dot q} = L\,M(q)$. The construction looks odd until you differentiate $\hat d$ and substitute the dynamics: every term with $\ddot q$ cancels, and what remains is

$$\dot{\hat d} = L\,(d - \hat d)$$

So the estimation error $e = d - \hat d$ obeys $\dot e = \dot d - L e$. If the disturbance changes slowly, $e$ decays exponentially at the rate set by $L$, and no acceleration signal is ever formed. That is the whole trick: $p(q,\dot q)$ is chosen so that the acceleration term appears twice with opposite signs.

For a single joint with constant inertia this collapses to $p = L J \dot q$ and a scalar gain $L$, which is what the simulation card runs.

## Choosing the observer gain

<!-- split: h3 -->
<!-- summary: L sets the error pole. Three questions decide it: how much noise you can afford, how fast the disturbance really moves, and where the estimate enters the loop. -->

Everything about tuning hides in one scalar (or one matrix) $L$. It is the pole of the estimation error, so it is tempting to make it large. The three cards under this one explain why you cannot, and how to pick it anyway.

### Bandwidth versus noise

<!-- summary: Velocity noise reaches the estimate scaled by L·J, unfiltered. Raise L until the torque command starts to chatter, then back off. -->

The estimate is $\hat d = z + L J \dot q_m$, where $\dot q_m$ is the *measured* velocity. A noise component $n$ in the velocity therefore appears in $\hat d$ as $L J\, n$, directly and without filtering. Doubling $L$ doubles the noise that reaches the torque command.

A practical procedure on hardware: start with $L$ well below the velocity-loop bandwidth and the first resonance, apply a known payload step, and raise $L$ until either the estimate settles in the time you need or the torque command visibly chatters, whichever comes first. If chatter comes first, filter the velocity measurement, and remember that the filter's lag now lives inside the observer too.

### What “slowly varying” costs

<!-- summary: For a disturbance at frequency ω the steady-state error ratio is ω / √(ω² + L²). Fast disturbances need a bigger L or a different observer. -->

The convergence proof assumes $\dot d \approx 0$. Real disturbances move. For a sinusoidal component at frequency $\omega$, the error dynamics $\dot e = \dot d - L e$ give a steady-state magnitude ratio

$$\frac{|e|}{|d|} = \frac{\omega}{\sqrt{\omega^2 + L^2}}$$

At $\omega = L$ the observer still misses about 71% of that component. To track a disturbance at $\omega$ to within 10% you need $L \approx 10\,\omega$. Periodic disturbances from gear meshing or a rotating payload are often faster than any $L$ the noise budget allows, which is where repetitive or harmonic observers take over.

### Where the estimate enters the loop

<!-- summary: Subtract d̂ from the nominal controller output. The plant then sees only the estimation error, and the controller can be tuned on the nominal model alone. -->

With a nominal controller output $u$, command

$$\tau = u - \hat d$$

and the closed-loop dynamics become $M\ddot q + C\dot q + g = u + (d - \hat d) = u + e$. The controller sees the nominal plant plus a residual that shrinks at rate $L$. This is why you can tune the PD or computed-torque loop on the nominal model and leave disturbance rejection to the observer.

Keep $\hat d$ out of the model-based terms, though. Feeding it into the $M(q)$ or $g(q)$ compensation creates an algebraic loop with the observer's own $p(q,\dot q)$ and is a common source of limit cycles.

## Implementation on a real joint

<!-- summary: Discretise z with forward Euler, keep T·L small, saturate d̂ to what the actuator can cancel, and freeze z when the torque saturates. -->

The observer is one first-order filter per joint, so it is cheap. The details that bite:

- **Discretisation.** Forward Euler $z_{k+1} = z_k + T\,\dot z_k$ is fine while $T L \lesssim 0.1$. At 1 kHz that caps $L$ near 100 rad/s before you need a better integrator.
- **Velocity source.** Use the same filtered velocity in $p$ and in $\dot z$. Mixing a raw and a filtered estimate creates a phantom disturbance at the filter's cutoff.
- **Saturation.** Clamp $\hat d$ to the torque headroom you actually have. An estimate the actuator cannot cancel only steals authority from the tracking controller.
- **Anti-windup.** When $\tau$ saturates, the plant no longer receives $\tau$, so hold $z$ instead of integrating with a torque that never happened.
- **Startup.** Initialise $z = -p(q_0,\dot q_0)$ so that $\hat d(0) = 0$ and the joint does not jump at power-on.

A minimal implementation for one joint, with the anti-windup hold:

```c
// per control tick, period T
float vm   = velocity_filtered();           // same source everywhere
float dhat = z + L * J * vm;
float tau  = clamp(u_nominal - clamp(dhat, -D_MAX, D_MAX), -TAU_MAX, TAU_MAX);
if (!saturated(tau)) {
    float zdot = -L * z - L * (tau - b * vm + L * J * vm);
    z += T * zdot;                          // forward Euler, T*L <= 0.1
}
```

## Interactive simulation

<!-- summary: A single joint with a square-wave payload, a tonal disturbance and Coulomb friction. Move the gain and the noise, and watch the estimate and the tracking error respond. -->

```widget
name: ndob-sim
gain: 30
noise: 0.05
```

The widget runs the scalar observer on a joint with $J = 0.02\ \mathrm{kg\,m^2}$ and $b = 0.05\ \mathrm{N\,m\,s}$, tracking $q_r = 0.5\sin(1.5t)$ with a PD controller plus nominal feedforward. The disturbance is a payload step every 2 s, a 7 rad/s tonal component, and Coulomb friction, which depends on the sign of velocity and is therefore nonlinear in the state.

Try two things. Raise $L$ until the estimate starts to chatter: that is the velocity noise arriving through $L J \dot q_m$. Then lower $L$ until the step takes longer than the 2 s between steps: that is the slowly-varying assumption failing.
