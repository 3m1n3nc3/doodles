# naives

Algorithmic doodle faces, in plain JavaScript. No dependencies.

The trick that makes it work: **the features are not positioned on a flat
canvas.** Each one owns a coordinate on an invisible 3D head — a longitude and
a latitude on a lumpy ellipsoid — and asks that head where it lands on screen.
So you can turn the head, and everything comes along: features slide and
foreshorten, the far ear goes behind the cheek, the hairline wraps, and the
nose keeps sticking out because it was never flat to begin with.

Same code path draws a frontal 48-face plate and a head at 70°.

```txt
                 v (latitude)
                    ▲                    features live here, on the surface:
                 ___│___                   eye   (u = ±0.45, v = +0.10)
              ,-'   │   `-.                nose  (u =  0,    v = -0.05, lift out)
             /      │      \               mouth (u =  0,    v = -0.55)
            |    ●  │  ●    |   ──► u      ear   (u = ±1.40, v =  0.00)
            |       │       |   (longitude)
             \   ╰──┴──╯   /             ...then rotate the head and project.
              `-._     _.-'
                  `---'
```

## Quick start

```bash
node bin/naives.js plate -o plate.svg          # a 6x8 sheet of faces
node bin/naives.js face --seed ada --yaw 40    # one face, turned 40°
node bin/naives.js turn --seed ada --frames 12 # one person, twelve angles
npm start                                      # the playground, on :5173
npm test
```

## The playground

`npm start` then open <http://localhost:5173/>. Three views over the same library:

- **Plate** — a grid of faces. Click any face to open it in 3D.
- **3D head** — drag to turn it, or auto-spin. Pin individual features from the
  dropdowns. Tick _show the skull_ to see the invisible head, its latitude
  rings, and a cross at every feature anchor with its outward normal.
- **Turntable** — one genome rendered across a sweep of angles.

PNG and SVG export from any view.

## Library

```js
import { SVGSurface, renderFace, renderPlate, makeGenome } from 'naives';

const svg = new SVGSurface({ width: 400, height: 480, background: '#efe9dd' });
renderFace(svg, { seed: 'ada', scale: 130, yaw: 0.4, pitch: 0.1 });
console.log(svg.toString());
```

In a browser, swap the surface and everything else is identical:

```js
import { Canvas2DSurface, renderFace } from 'naives';
const surface = new Canvas2DSurface(canvas.getContext('2d'), 400, 480);
renderFace(surface, { seed: 'ada', scale: 130 });
```

### A face is a genome

Every face is a pure function of its seed, and the intermediate form is plain
serialisable data. Print it, change one field, hand it back.

```js
const genome = makeGenome('ada');
// { skull: { name: 'potato', rx, ry, rz, lobes, wobble },
//   eyes: { u, v, left: { type: 'slit', size }, right: {...} },
//   nose: { type: 'blob', size, v }, hair: {...}, hat: {...}, ... }

renderFace(svg, { genome, yaw: 0.6 }); // reuse: same person, new angle
renderFace(svg, { seed: 'ada', traits: { nose: 'hook', hair: 'mohawk' } });
renderFace(svg, {
  seed: 'ada',
  traits: { eyes: { left: { type: 'spiral' } } },
});
```

Overrides merge deeply and a bare string sets that category's `type`, so
`{ nose: 'hook' }` is shorthand for `{ nose: { type: 'hook' } }`. The CLI takes
the same paths: `naives face --nose hook --eyes.left.type spiral`.

### The head, on its own

`Head` is useful without any drawing. It answers geometric questions.

```js
import { Head } from 'naives';
const head = new Head({ rx: 1, ry: 1.15, rz: 0.9, scale: 100, yaw: 0.6 });

const f = head.frame(0.45, 0.1); // a drawing frame glued to the skull
f.map(0, 0); // -> [x, y] in pixels
f.map(0.1, 0, 0.2); // 0.1 across the face, 0.2 out of it
f.facing; // > 0 means this skin faces the viewer

head.silhouette(); // the outline, as an exact occluding contour
head.ring({ v: 0.45 }); // a latitude ring: hairlines, hatbands, straps
head.cap({ v: 0.45 }); // everything above that line, bounded by the outline
head.cap({ v: -0.3, below: true }); // ...and everything below it: beards, scarves
```

`cap()` is what hair, hats, beards and masks are built from, which is why they
wrap correctly at any angle instead of sliding off.

## How it draws

| module          | job                                                              |
| --------------- | ---------------------------------------------------------------- |
| `src/head.js`   | the invisible head: anchors, silhouette, latitude rings, caps    |
| `src/pen.js`    | the hand: resampling, wobble, double strokes, hatching, scribble |
| `src/surfaces/` | output targets — `SVGSurface`, `Canvas2DSurface` (4 calls each)  |
| `src/genome.js` | seed → traits                                                    |
| `src/face.js`   | layer order, and the feature-space helpers                       |
| `src/features/` | 132 variants across 11 categories                                |
| `src/rig.js`    | draw the invisible head, visibly                                 |

Two details do most of the aesthetic work:

**The silhouette is exact, not sampled.** The screen shadow of an ellipsoid is
the image of the unit circle lying perpendicular to the view-null direction, so
`silhouette()` solves for it directly. Each contour point remembers which skull
direction produced it, which means the hand-drawn lumpiness is welded to the
skull and doesn't swim across the outline as the head turns.

**Nothing is a straight line.** Every stroke is resampled, pushed around by a
smooth AR(1) walk perpendicular to itself, bowed once across its length like a
wrist, drawn twice at different pressure, and allowed to overshoot its ends.

## Feature catalogue

```bash
node bin/naives.js list          # all 132 variants
node bin/naives.js list eyes
npm run sheets                   # a contact sheet per category, in out/
```

eyes (17) · nose (13) · mouth (16) · brow (9) · ears (5) · hair (17) ·
hat (11) · beard (11) · accessories (12) · marks (10) · backdrop (11)

## CLI

```txt
naives face   [--seed s] [--yaw deg] [--pitch deg] [--roll deg] [--size px] [-o f.svg]
naives plate  [--cols 6] [--rows 8] [--seed s] [--turn deg] [--tilt deg] [-o f.svg]
naives turn   [--seed s] [--frames 12] [--sweep deg] [-o f.svg]
naives sheet  --category eyes|nose|mouth|brow|ears|hair|hat|beard|accessories|marks|backdrop
naives genome [--seed s] [--json]
naives list   [category]
```

Any trait can be pinned on any command.

## Deploy

The playground is plain ES modules, so there is nothing to bundle. `npm run
build` lays the files out for a static host — the page at the root, the library
under `./src/` — which comes to about 130 kB.

```bash
npm run build          # -> dist/
npm start dist         # preview exactly what will be deployed, on :5173
```

`netlify.toml` is already set up (`command = "npm run build"`, `publish = "dist"`),
so any of these work:

```bash
# 1. one-off, no account plumbing: drag dist/ onto app.netlify.com/drop

# 2. from the terminal
npx netlify-cli deploy --prod        # or: npm i -g netlify-cli && netlify deploy --prod

# 3. connect the Git repo in the Netlify UI and it reads netlify.toml
```

Nothing runs on the server — no functions, no env vars, no origin requests. It
is a static page that draws everything in the browser, so it also deploys
unchanged to GitHub Pages, Cloudflare Pages or Vercel; point them at
`npm run build` and `dist`.

## Credit

The look is modelled on Mannay's hand-drawn face plates. This is an attempt to
reach the same place with code — not a copy of any individual drawing.

MIT.
