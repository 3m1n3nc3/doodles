/**
 * naives -- algorithmic doodle faces.
 *
 *   import { face, plate, SVGSurface } from 'naives';
 *
 *   const svg = new SVGSurface({ width: 400, height: 500 });
 *   face(svg, { seed: 'hello', yaw: 0.4 });
 *   console.log(svg.toString());
 */

export { Head } from './head.js'
export { Pen } from './pen.js'
export { Rng, hashSeed } from './rng.js'
export { SVGSurface } from './surfaces/svg.js'
export { Canvas2DSurface } from './surfaces/canvas2d.js'
export { makeGenome, describe, applyOverrides, SKULLS } from './genome.js'
export { makePalette, PAPER, INK, SKIN, HAIR, WASH, CLOTH, ACCENT } from './palette.js'
export { renderFace, renderFace as face } from './face.js'
export { renderPlate, renderPlate as plate } from './plate.js'
export * as shapes from './shapes.js'
export { drawRig } from './rig.js'

export { eyes, EYE_WEIGHTS } from './features/eyes.js'
export { noses, NOSE_WEIGHTS } from './features/nose.js'
export { mouths, brows, ears, MOUTH_WEIGHTS, BROW_WEIGHTS, EAR_WEIGHTS } from './features/mouth.js'
export { hair, HAIR_WEIGHTS, HAIRLINES } from './features/hair.js'
export { hats, HAT_WEIGHTS } from './features/hats.js'
export { facialHair, BEARD_WEIGHTS, MOUSTACHE_WEIGHTS } from './features/facialhair.js'
export { accessories, ACCESSORY_WEIGHTS } from './features/accessories.js'
export { marks, MARK_WEIGHTS } from './features/marks.js'
export { backdrops, BACKDROP_WEIGHTS } from './features/backdrop.js'

/** Every feature variant, by category -- useful for building pickers. */
export async function catalogue() {
  const [e, n, m, h, ht, fh, ac, mk, bd] = await Promise.all([
    import('./features/eyes.js'), import('./features/nose.js'), import('./features/mouth.js'),
    import('./features/hair.js'), import('./features/hats.js'), import('./features/facialhair.js'),
    import('./features/accessories.js'), import('./features/marks.js'), import('./features/backdrop.js'),
  ])
  
return {
    eyes: Object.keys(e.eyes),
    nose: Object.keys(n.noses),
    mouth: Object.keys(m.mouths),
    brow: Object.keys(m.brows),
    ears: Object.keys(m.ears),
    hair: Object.keys(h.hair),
    hat: Object.keys(ht.hats),
    beard: Object.keys(fh.facialHair),
    accessories: Object.keys(ac.accessories),
    marks: Object.keys(mk.marks),
    backdrop: Object.keys(bd.backdrops),
  }
}
