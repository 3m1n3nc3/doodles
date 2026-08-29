/**
 * Glasses, patches, ties, flowers. Glasses are the clearest payoff of the 3D
 * layout: the lenses sit at the eye anchors, the bridge spans between them in
 * space, and the arms run back to the ears -- so a three-quarter view gets the
 * near lens large, the far lens squashed, and one arm hidden.
 */

import { curve, oval } from '../shapes.js'

function lensPoly(shape, s) {
  if (shape === 'square') return [[-s, -s * 0.78], [s, -s * 0.78], [s, s * 0.78], [-s, s * 0.78]]
  if (shape === 'rounded') return curve([[-s, -s * 0.6], [0, -s * 0.85], [s, -s * 0.6], [s * 1.05, s * 0.3], [0, s * 0.85], [-s * 1.05, s * 0.3], [-s, -s * 0.6]], 4)

  return oval(0, 0, s, s * 0.92, 0, 18)
}

function eyeFrames(c) {
  const g = c.g.eyes

  return [-1, 1].map((side) => ({
    side,
    f: c.head.frame((g.u + g.skewU) * side, g.v + side * g.skewV),
  }))
}

export const accessories = {
  glasses(c, g) {
    const frames = eyeFrames(c)
    const pts = []
    for (const { side, f } of frames) {
      if (f.facing < -0.05) {
        pts.push(null); continue
      }
      const poly = f.poly(lensPoly(g.shape, g.size))
      if (g.tint) c.pen.blob(poly, { color: g.tint, alpha: g.tintAlpha ?? 0.9, rough: 0.6 })
      c.pen.stroke(poly, { closed: true, color: g.color, weight: g.weight, passes: 2, rough: 0.7 })
      pts.push({ side, f, inner: f.map(-side * g.size * 0.95, 0), outer: f.map(side * g.size * 0.95, 0) })
    }
    const a = pts[0], b = pts[1]
    if (a && b) c.pen.stroke([a.inner, b.inner], { color: g.color, weight: g.weight * 0.9 })
    // Arms, running back along the skull to each ear.
    for (const p of pts) {
      if (!p) continue
      const ear = c.head.frame(1.35 * p.side, c.g.eyes.v - 0.08)
      if (ear.facing < -0.05) continue
      c.pen.stroke([p.outer, ear.map(0, 0)], { color: g.color, weight: g.weight * 0.8, passes: 1 })
    }
  },

  monocle(c, g) {
    const side = g.side
    const gg = c.g.eyes
    const f = c.head.frame((gg.u + gg.skewU) * side, gg.v + side * gg.skewV)
    if (f.facing < -0.05) return
    const poly = f.poly(oval(0, 0, g.size * 1.15, g.size * 1.1, 0, 18))
    c.pen.stroke(poly, { closed: true, color: g.color, weight: g.weight * 1.1, passes: 2 })
    const start = f.map(side * g.size * 1.1, g.size * 0.6)
    const chain = [start]
    let p = start
    for (let i = 0; i < 5; i++) {
      p = [p[0] + side * c.px * 0.03, p[1] + c.px * 0.09]
      chain.push(p)
    }
    c.pen.stroke(curve(chain), { color: g.color, weight: 0.5, passes: 1, alpha: 0.8, dash: `${c.px * 0.03} ${c.px * 0.02}` })
  },

  eyepatch(c, g) {
    const side = g.side
    const gg = c.g.eyes
    const f = c.head.frame((gg.u + gg.skewU) * side, gg.v + side * gg.skewV)
    if (f.facing > -0.05) {
      const poly = f.poly(oval(0, 0, g.size * 1.05, g.size * 1.12, c.rng.jitter(0.2), 16))
      c.pen.blob(poly, { color: g.color, rough: 1 })
      c.pen.stroke(poly, { closed: true, color: c.pal.ink, weight: 0.6, passes: 1, alpha: 0.7 })
    }
    // The strap is a tilted ring around the whole skull.
    const axis = [-side * 0.42, 0.86, 0.28]
    const ring = c.head.ring({ v: 0.06, axis, grow: 0.02 })
    const vis = ring.filter((r) => r.facing > -0.02).map((r) => r.p)
    if (vis.length > 2) c.pen.stroke(vis, { color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.85 })
  },

  mask(c, g) {
    // Bandit band across the eyes, with the eyes cut back in on top.
    const b = c.head.cap({ v: c.g.eyes.v - 0.16, grow: 0.014 })
    const top = c.head.cap({ v: c.g.eyes.v + 0.3, grow: 0.014, edgeOnly: true })
    const poly = b.edge.concat(top.edge.slice().reverse())
    c.pen.blob(poly, { color: g.color, rough: 0.9 })
    for (const { f } of eyeFrames(c)) {
      if (f.facing < -0.05) continue
      const hole = f.poly(oval(0, 0, 0.2, 0.16, 0, 16))
      c.pen.blob(hole, { color: c.pal.skin || c.pal.paper, rough: 1.1 })
      c.pen.stroke(hole, { closed: true, color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.6 })
      c.pen.dot(...f.map(0, 0), c.px * 0.026)
    }
  },

  faceMask(c, g) {
    const b = c.head.cap({ v: c.g.mouth.v + 0.3, below: true, grow: 0.02 })
    c.pen.blob(b.poly, { color: g.color, rough: 0.8, alpha: 0.95 })
    c.pen.stroke(b.edge, { color: c.pal.ink, weight: 0.8, passes: 1 })
    for (const side of [-1, 1]) {
      const e = c.head.frame(1.3 * side, 0.02)
      if (e.facing < 0.02) continue
      const from = c.head.frame(1.0 * side, c.g.mouth.v + 0.25).map(0, 0)
      c.pen.stroke([from, e.map(0, 0)], { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.7 })
    }
  },

  bowtie(c, g) {
    const f = c.head.frame(0, -1.42, 0.06)
    const s = g.size
    const knot = f.map(0, 0)
    for (const side of [-1, 1]) {
      const wing = [[0, 0], [side * s * 2, -s * 0.9], [side * s * 2, s * 0.9]]
      c.pen.stroke(f.poly(wing), { closed: true, color: c.pal.ink, weight: 0.7, fill: g.color })
    }
    c.pen.ellipse(knot[0], knot[1], c.px * s * 0.45, c.px * s * 0.5, 0, { fill: g.color, weight: 0.6, segments: 10 })
  },

  necktie(c, g) {
    const f = c.head.frame(0, -1.45, 0.04)
    const s = g.size
    c.pen.stroke(f.poly([[-s * 0.5, 0], [s * 0.5, 0], [s * 0.35, s * 0.7], [0, s * 1.5], [-s * 0.35, s * 0.7]]),
      { closed: true, color: c.pal.ink, weight: 0.7, fill: g.color })
  },

  collar(c, g) {
    const f = c.head.frame(0, -1.32, 0.02)
    c.pen.stroke(f.poly([[-0.5, 0.3], [-0.14, 0.02]]), { color: c.pal.ink, weight: 0.9 })
    c.pen.stroke(f.poly([[0.5, 0.3], [0.14, 0.02]]), { color: c.pal.ink, weight: 0.9 })
    if (g.buttons) c.pen.dot(...f.map(0, 0.22), c.px * 0.02)
  },

  scarf(c, g) {
    const b = c.head.cap({ v: -1.16, below: true, grow: 0.06 })
    c.pen.blob(b.poly, { color: g.color, rough: 0.9 })
    c.pen.stroke(b.edge, { color: c.pal.ink, weight: 0.8, passes: 1 })
  },

  flower(c, g) {
    const f = c.head.frame(g.u, g.v)
    if (f.facing < 0.05) return
    const r = 0.09
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r
      c.pen.stroke(f.poly(oval(cx, cy, r * 0.72, r * 0.72, 0, 10)),
        { closed: true, color: c.pal.ink, weight: 0.5, passes: 1, fill: g.color })
    }
    c.pen.dot(...f.map(0, 0), c.px * 0.018, { color: c.pal.accent.yellow })
  },

  sweat(c, g) {
    const f = c.head.frame(g.side * 0.95, 0.72)
    if (f.facing < 0.05) return
    const p = f.map(0.25, -0.1)
    c.pen.stroke([[p[0], p[1]], [p[0] + g.side * c.px * 0.06, p[1] - c.px * 0.12]],
      { color: c.pal.accent.cyan, weight: 0.8, passes: 1 })
  },

  earbuds(c) {
    for (const side of [-1, 1]) {
      const e = c.head.frame(1.3 * side, 0.0)
      if (e.facing < 0.04) continue
      const p = e.map(0, 0.15)
      c.pen.dot(p[0], p[1], c.px * 0.035, { color: c.pal.ink })
      c.pen.stroke([p, [p[0] + side * c.px * 0.02, p[1] + c.px * 0.3]], { color: c.pal.ink, weight: 0.5, passes: 1 })
    }
  },
}

export const ACCESSORY_WEIGHTS = [
  ['glasses', 16], ['monocle', 4], ['eyepatch', 5], ['mask', 3], ['faceMask', 2],
  ['bowtie', 5], ['collar', 6], ['necktie', 2], ['scarf', 2], ['flower', 3],
  ['sweat', 2], ['earbuds', 1.5],
]

export function drawAccessories(c) {
  for (const a of c.g.accessories) {
    const fn = accessories[a.type]
    if (fn) fn(c, a)
  }
}
