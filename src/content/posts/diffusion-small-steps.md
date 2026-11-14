---
title: Why Small Steps Make the Reverse Diffusion Step Normal
description: Diffusion models assume each denoising step is a normal distribution. A plain-English explanation of why that is only reasonable when the noise added per step is small, with an interactive one-dimensional example.
date: 2026-11-14
tags: [diffusion, generative-models, probability]
split: h2
---

# Why Small Steps Make the Reverse Diffusion Step Normal

<!-- summary: The decoder of a diffusion model treats every reverse step as a normal distribution. That is wrong in general and nearly right when $\beta_t$ is small. The reason fits in one picture: a narrow window, and a hill that looks like a ramp through it. -->

Chapter 18 of Simon Prince's *Understanding Deep Learning* builds the decoder of a diffusion model from normal distributions, and says this approximation is reasonable if the hyperparameters $\beta_t$ are close to zero. Ho et al. (2020) and Lilian Weng's blog post say the same thing in one sentence each. None of them shows why.

The short answer: a small $\beta_t$ means the previous value must lie very close to the current one. Over such a short distance, the complicated distribution of the data can only *tilt* the answer a little. It cannot give it two humps or a lopsided shape. A normal curve that is tilted a little is still a normal curve, with its centre moved.

The cards below build that answer step by step. Only two tools are needed: Bayes' rule and the formula of the normal curve. The last card is a live example where you can shrink $\beta$ and watch the true reverse step become normal.

## The setup in two formulas

<!-- summary: The forward step shrinks the value a little and adds noise of variance $\beta_t$. The decoder assumes the reverse step is normal, with a mean computed by a network. -->

The notation follows the book: $x$ is a data example and $z_1, \dots, z_T$ are its noisier and noisier versions. Ho et al. and Lil'Log write $x_0$ for the data and $x_t$ for $z_t$.

**Forward step (encoder).** Shrink the previous value a little and add fresh noise:

$$
z_t = \sqrt{1-\beta_t}\; z_{t-1} + \sqrt{\beta_t}\;\epsilon_t, \qquad \epsilon_t \sim \mathcal N(0, 1)
$$

So $\beta_t$ is the variance of the noise added in step $t$, and $\sqrt{\beta_t}$ is the typical size of the jump. Written as a distribution, this is $q(z_t \mid z_{t-1}) = \mathcal N\big(\sqrt{1-\beta_t}\,z_{t-1},\ \beta_t\big)$.

**Reverse step (decoder).** To generate data we must walk backwards: given $z_t$, draw a plausible $z_{t-1}$. The model *assumes* this is a normal distribution:

$$
Pr(z_{t-1} \mid z_t) = \mathcal N\big(f_t[z_t],\ \sigma_t^2\big)
$$

where $f_t$ is a neural network that outputs the mean, and $\sigma_t^2$ is a fixed number. The question of this article is whether that assumption is justified.

Everything here is written for one number per variable. For images, the same argument holds with vectors.

## The true reverse step is a product of two curves

<!-- summary: Bayes' rule: the true reverse distribution is "which previous values could have produced $z_t$" times "which previous values are common at all". -->

The true reverse distribution is given by Bayes' rule:

$$
q(z_{t-1} \mid z_t) \;\propto\; q(z_t \mid z_{t-1}) \;\cdot\; q(z_{t-1})
$$

Read it as two questions about a candidate previous value $z_{t-1}$, with the answers multiplied:

1. **Could it have produced what I see?** $q(z_t \mid z_{t-1})$ is large when one forward step from this candidate would plausibly land on the observed $z_t$. This is the brown curve in the book's Figure 18.5.
2. **Is it a common value in the first place?** $q(z_{t-1})$ is how the values at step $t-1$ are distributed over the whole dataset. This is the gray curve.

A candidate must score well on both. The product, rescaled to have area one, is the true reverse distribution: the cyan curve.

The second factor is the troublemaker. It is the data distribution blurred by $t-1$ steps of noise, so it depends on the whole dataset and has no formula. If the data has several clusters, it has several bumps.

## Why the product is usually not normal

<!-- summary: With a large step, many previous values could explain $z_t$, so the bumps of the data distribution show through and the reverse step gets several humps. -->

Suppose the data has two clusters, one near $-1$ and one near $+1$, and the step is large. You observe $z_t = 0$.

Question 1 gives a weak answer: with a large step, a previous value anywhere between $-1$ and $+1$ could have landed on $0$. Question 2 then decides, and it says values near $-1$ and near $+1$ are common while values near $0$ are rare. The product has **two humps**. A normal curve has one, so no choice of mean and variance fits it.

This is what the book means by "complex multi-modal distributions". When the first factor is wide, the shape of the second factor shows through, and that shape can be anything.

## A small step turns the first factor into a narrow window

<!-- summary: As a function of the previous value, the first factor is a normal bump centred next to $z_t$ with width about $\sqrt{\beta_t}$. Small $\beta_t$, narrow window. -->

Now look at the first factor more closely. As a function of the candidate $z_{t-1}$, with the observed $z_t$ held fixed, it is itself a normal-shaped bump:

<!-- preview -->

$$
q(z_t \mid z_{t-1}) \;\propto\; \exp\!\left(-\frac{(z_{t-1} - c)^2}{2 s^2}\right), \qquad c = \frac{z_t}{\sqrt{1-\beta_t}}, \quad s^2 = \frac{\beta_t}{1-\beta_t}
$$

<!-- /preview -->

This is the forward formula solved for $z_{t-1}$ instead of $z_t$. No approximation is involved.

When $\beta_t$ is small, the centre $c$ is almost exactly $z_t$ and the width $s$ is almost exactly $\sqrt{\beta_t}$. With $\beta_t = 0.0001$ the width is $0.01$.

So the first factor acts as a **window**. It says: the previous value was within a few times $\sqrt{\beta_t}$ of where you are now, and everything outside is ruled out. The second factor still gets a vote, but only about the values inside the window.

## Through a narrow window, a hill looks like a ramp

<!-- summary: Inside a window much narrower than the bumps of $q(z_{t-1})$, the logarithm of $q(z_{t-1})$ is close to a straight line. Only its slope matters. -->

Here is the one idea the whole result rests on. It is the idea behind every tangent line in calculus:

> Any smooth curve, seen through a narrow enough window, looks like a straight line.

The Earth is round, but a football field is flat. In the same way $q(z_{t-1})$ may have many bumps, but inside a window much narrower than those bumps, all you can see is a slope.

It is most convenient to apply this to the *logarithm* of the second factor, because multiplying curves is the same as adding their logarithms. Inside the window:

$$
\log q(z_{t-1}) \;\approx\; \text{constant} + g\,(z_{t-1} - c)
$$

The single number $g$ is the slope of $\log q$ at the centre of the window. It says in which direction the common values lie, and how strongly. If $g > 0$, values to the right are more common. The rest of the complicated curve, with all its clusters, is outside the window and has no effect.

## A bump times a ramp is the same bump, shifted

<!-- summary: Add the logs: a downward parabola plus a straight line is the same parabola moved sideways. So the reverse step is normal, with variance about $\beta_t$ and a mean shifted towards where the data is. -->

Add the logarithms of the two factors.

- The log of the window is a **downward parabola**: $-\dfrac{(z_{t-1}-c)^2}{2s^2}$. That is what makes a normal curve a normal curve.
- The log of the second factor is, inside the window, a **straight line**: $g\,(z_{t-1}-c)$.

A parabola plus a straight line is a parabola of the same width, moved sideways. Writing $u = z_{t-1} - c$ and completing the square:

$$
-\frac{u^2}{2s^2} + g\,u \;=\; -\frac{(u - s^2 g)^2}{2 s^2} + \text{constant}
$$

A downward parabola in the exponent is a normal distribution, so:

<!-- preview -->

$$
q(z_{t-1} \mid z_t) \;\approx\; \mathcal N\big(c + s^2 g,\ \ s^2\big) \;\approx\; \mathcal N\big(z_t + \beta_t\,g,\ \ \beta_t\big)
$$

The true reverse step is approximately normal. Its variance is known in advance, and its mean is $z_t$ nudged towards where the data is.

<!-- /preview -->

(The last form drops terms that are smaller still when $\beta_t$ is small.)

This explains the decoder's design, not only its shape:

- **The variance is fixed, not learned.** It is about $\beta_t$, whatever the data is. This is why the book sets $\sigma_t^2$ from the noise schedule.
- **The mean needs a network.** The shift $\beta_t\,g$ depends on the slope $g$ of $\log q(z_{t-1})$, which depends on the whole dataset and on where you are. Nobody can write it down, so $f_t[z_t]$ learns it. That slope is what the literature calls the *score*.

One step further: if you also keep the *bend* of $\log q$, you add a second parabola. A parabola plus a parabola is still a parabola, so the result is still exactly normal, with a slightly different width. The normal shape breaks only when the bend itself changes across the window, and that effect shrinks faster than the others as the window narrows.

## How small is small enough?

<!-- split: h3 -->
<!-- summary: The window $\sqrt{\beta_t}$ must be narrow compared with the bumps of $q(z_{t-1})$. Those bumps are widest late in the diffusion and sharpest near the data. -->

"Close to zero" has no meaning on its own. The argument needs the window to be narrow **compared with the features of $q(z_{t-1})$**: roughly, $\sqrt{\beta_t}$ much smaller than the width of its bumps.

### Numbers from a one-dimensional example

<!-- summary: With bumps about 0.35 wide, $\beta = 0.2$ gives an 18% mismatch with the best normal curve, $\beta = 0.02$ gives 2.7%, and $\beta = 0.001$ under 0.1%. -->

The data in the simulation card has three clusters. After a little noise, the bumps of $q(z_{t-1})$ are about $0.35$ wide. For an observed $z_t = -0.5$, between two clusters, the true reverse step was computed exactly and compared with the normal curve of the same mean and variance. "Mismatch" is the share of probability the two curves place differently: 0% means identical.

| $\beta$ | window width | mismatch | true mean | mean from the ramp rule |
|---|---|---|---|---|
| 0.5 | 1.00 | 21.2% | −0.488 | −3.614 |
| 0.2 | 0.50 | 17.9% | −0.544 | −0.623 |
| 0.05 | 0.23 | 7.4% | −0.495 | −0.467 |
| 0.02 | 0.14 | 2.7% | −0.491 | −0.484 |
| 0.005 | 0.07 | 0.4% | −0.496 | −0.496 |
| 0.001 | 0.03 | under 0.1% | −0.499 | −0.499 |

Once the window is clearly narrower than the bumps, the mismatch falls quickly and the ramp rule $c + s^2 g$ predicts the mean to three decimals. With a wide window the ramp rule is nonsense, as it should be: the straight line was never a fair description of the hill.

### Where the approximation is weakest

<!-- summary: Close to the data, $q(z_{t-1})$ has had little blurring and can be sharp, so the same $\beta$ that is fine late in the chain is too large early on. -->

The second factor $q(z_{t-1})$ is the data distribution blurred by all the noise added so far. Late in the diffusion it is nearly a standard normal curve, smooth and wide, so almost any window is narrow enough. Close to the data it has had little blurring and can have sharp features.

The same example with $\beta = 0.02$ throughout, taking the worst case over all observed values:

| noise already in $z_{t-1}$ | worst mismatch |
|---|---|
| none (the clean data) | 45.8% |
| 2% | 25.5% |
| 10% | 3.4% |
| 50% | under 0.1% |

This is why noise schedules start with very small steps and grow. Ho et al. use $\beta_1 = 0.0001$, rising in a straight line to $\beta_T = 0.02$, and they treat the very last reverse step, the one that lands on the data, as a special case.

## The price: many steps

<!-- summary: Each small step destroys little information, so reaching pure noise takes many of them. That is why DDPM uses $T = 1000$ and why sampling is slow. -->

The encoder must end at pure noise, with no trace of the data left. If every step adds only a little noise, that takes a great many steps. With the schedule of Ho et al., $T = 1000$.

So the book's condition has two halves that belong together: $\beta_t$ close to zero **and** $T$ large. Small steps buy a decoder that can be built from simple normal distributions. The cost is that generating one sample runs the network a thousand times. Much later work on faster samplers is an attempt to cut that cost without losing the benefit.

There is also a classical result behind the statement. Sohl-Dickstein et al. (2015), the paper Ho et al. cite for it, point to Feller (1949): in the limit of infinitely small steps, a diffusion process run backwards is again a diffusion process of the same form. The argument above is that result seen one step at a time.

## Try it

<!-- summary: A one-dimensional example with three clusters. Shrink $\beta$ and watch the true reverse step change from a lopsided, two-humped curve into a normal one. -->

```widget
name: reverse-step
beta: 0.2
zt: -0.5
noise: 0.1
```

The upper plot shows the two factors and their product over the whole axis. The lower plot zooms in on the product, the true reverse step, and draws the best normal curve over it as a dashed line.

Three things to try:

1. **Shrink the step size.** At $\beta = 0.2$ the product leans across two clusters. Slide towards $0.001$: the window narrows, and in the lower plot the solid and dashed curves merge.
2. **Move the observed value** with a large $\beta$. Between clusters the reverse step is two-humped. Inside a cluster it is close to normal even for a large step, because one bump dominates the window.
3. **Set "noise already added" to zero**, then to $0.5$, with $\beta = 0.02$. Near the clean data the same step size is too large. Later in the chain it is more than small enough.

## Summary

<!-- summary: Bayes' rule gives window × data. Small $\beta_t$ makes the window narrow; through it the data term is a ramp; a normal bump times a ramp is a shifted normal bump. -->

1. The true reverse step is a product: a **window** of width about $\sqrt{\beta_t}$ around $z_t$, times the **distribution of previous values**, which is complicated and unknown.
2. With a large $\beta_t$ the window is wide, the complicated factor shows through, and the reverse step can have several humps.
3. With a small $\beta_t$ the window is narrow. Through it, the log of the complicated factor is a straight line.
4. A normal bump times such a ramp is a normal bump with the same width and a shifted centre. So the reverse step is close to $\mathcal N(z_t + \beta_t\,g,\ \beta_t)$.
5. The variance is known, and the shift is what the network learns.
6. "Small" means small compared with the features of $q(z_{t-1})$, which are sharpest near the data. The price of small steps is a large $T$.

**Sources**

- S. J. D. Prince, *Understanding Deep Learning*, chapter 18, sections 18.2 and 18.3 and Figure 18.5.
- J. Ho, A. Jain and P. Abbeel, "Denoising Diffusion Probabilistic Models", 2020, section 2: the forward and reverse processes "have the same functional form" when $\beta_t$ are small.
- L. Weng, "What are Diffusion Models?", Lil'Log, 2021: if $\beta_t$ is small enough, the reverse conditional is also Gaussian.
- J. Sohl-Dickstein, E. Weiss, N. Maheswaranathan and S. Ganguli, "Deep Unsupervised Learning using Nonequilibrium Thermodynamics", 2015, and W. Feller, "On the theory of stochastic processes, with particular reference to applications", 1949.
