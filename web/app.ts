/**
 * naives playground.
 *
 * Three views over the same library: a plate of faces, one head you can turn
 * with the mouse, and a turntable contact sheet. Everything is rendered live to
 * a canvas; PNG and SVG export go through the same drawing code.
 */

import {
  Canvas2DSurface,
  Rng,
  SVGSurface,
  describe,
  drawRig,
  makeGenome,
  renderFace,
  renderPlate,
} from '../src/index'
import { brows, ears, mouths } from '../src/features/mouth'

import { backdrops } from '../src/features/backdrop'
import { eyes } from '../src/features/eyes'
import { facialHair } from '../src/features/facialhair'
import { hair } from '../src/features/hair'
import { hats } from '../src/features/hats'
import { noses } from '../src/features/nose'

import type { Overrides, PlateCell } from '../src/index'

type Tab = 'plate' | 'head' | 'turn'

/** The one element lookup, narrowed at each call site by the caller. */
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T

const stage = $<HTMLCanvasElement>('stage')
const ctx = stage.getContext('2d')!

interface State {
  tab: Tab
  seed: string
  cols: number
  rows: number
  turn: number
  tilt: number
  paper: boolean
  yaw: number
  pitch: number
  roll: number
  spin: boolean
  rig: boolean
  frames: number
  sweep: number
  /** feature category -> variant name ('' = let the seed decide) */
  pinned: Record<string, string>
  plateFaces: PlateCell[]
  /** canvas size in CSS px, before device scaling */
  logical: { w: number, h: number }
}

const state: State = {
  tab: 'plate',
  seed: 'naives',
  cols: 6, rows: 8, turn: 0, tilt: 0, paper: true,
  yaw: 0, pitch: 0, roll: 0, spin: false, rig: false,
  frames: 10, sweep: 160,
  pinned: {},
  plateFaces: [],
  logical: { w: 0, h: 0 },
}

/** Matches the CSS breakpoint, so layout and sizing agree. */
const narrow = () => window.matchMedia('(max-width: 720px)').matches

// --------------------------------------------------------------- geometry

/**
 * Logical canvas size for the current view.
 *
 * Width comes from the layout, but height comes from the *viewport* -- on a
 * narrow screen the canvas is what gives `main` its height, so measuring the
 * parent's height to size the canvas is circular and collapses it to nothing.
 */
interface Size {
  w: number
  h: number
  cols?: number
  rows?: number
  cell?: number
}

function sizeFor(): Size {
  const rect = stage.parentElement!.getBoundingClientRect()
  const pad = narrow() ? 12 : 24
  const page = document.documentElement.clientWidth
  const availW = Math.max(260, Math.min(rect.width, page) - pad * 2)
  const availH = Math.max(300, window.innerHeight - rect.top - pad * 2)

  if (state.tab === 'plate') {
    // Phones fit the width and let the sheet scroll; wider screens fit both,
    // so the whole plate is visible at once.
    const cell = narrow() ? availW / state.cols : Math.min(availW / state.cols, availH / state.rows)

    return { w: Math.round(cell * state.cols), h: Math.round(cell * state.rows) }
  }
  if (state.tab === 'turn') {
    const cols = Math.min(state.frames, narrow() ? 2 : 5)
    const rows = Math.ceil(state.frames / cols)
    const cell = narrow() ? availW / cols : Math.min(availW / cols, availH / rows)

    return { w: Math.round(cell * cols), h: Math.round(cell * rows), cols, rows, cell }
  }
  const s = narrow() ? availW : Math.min(availW, availH)

  return { w: Math.round(s), h: Math.round(s) }
}

function fitCanvas(w: number, h: number): Canvas2DSurface {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  stage.width = Math.round(w * dpr)
  stage.height = Math.round(h * dpr)
  stage.style.width = `${w}px`
  stage.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  state.logical = { w, h }

  return new Canvas2DSurface(ctx, w, h)
}

function traits(): Overrides {
  const t: Overrides = {}
  for (const [k, v] of Object.entries(state.pinned)) {
    if (!v) continue
    if (k === 'eyes') t.eyes = { left: { type: v }, right: { type: v } }
    else t[k] = v
  }

  return t
}

// ------------------------------------------------------------------ draw

function draw(): void {
  const size = sizeFor()
  const surface = fitCanvas(size.w, size.h)
  const rng = new Rng(`${state.seed}~paper`)
  surface.background('#efe9dd')

  if (state.tab === 'plate') {
    state.plateFaces = renderPlate(surface, {
      cols: state.cols, rows: state.rows, seed: state.seed,
      turn: (state.turn * Math.PI) / 180,
      tilt: (state.tilt * Math.PI) / 180,
      lean: 0.05,
      paper: false,
    })
    if (state.paper) surface.paperTexture({ opacity: 0.05, rng: () => rng.next() })
    $('desc').textContent = `${state.plateFaces.length} faces · seed "${state.seed}"`

    return
  }

  if (state.tab === 'turn') {
    const g = makeGenome(state.seed, traits())
    const cols = size.cols!, cell = size.cell!
    for (let i = 0; i < state.frames; i++) {
      const t = state.frames === 1 ? 0 : i / (state.frames - 1)
      const sweep = (state.sweep * Math.PI) / 180
      renderFace(surface, {
        genome: g,
        cx: cell * (0.5 + (i % cols)),
        cy: cell * (0.5 + Math.floor(i / cols)),
        scale: cell * 0.3,
        yaw: -sweep / 2 + sweep * t,
        pitch: ((state.pitch * Math.PI) / 180) + Math.sin(t * Math.PI * 2) * 0.12,
        roll: (state.roll * Math.PI) / 180,
        backdrop: false,
      })
    }
    if (state.paper) surface.paperTexture({ opacity: 0.05, rng: () => rng.next() })
    $('desc').textContent = describe(g)

    return
  }

  // Single head.
  const res = renderFace(surface, {
    seed: state.seed,
    traits: traits(),
    cx: size.w / 2, cy: size.h / 2,
    scale: Math.min(size.w, size.h) * 0.3,
    yaw: (state.yaw * Math.PI) / 180,
    pitch: (state.pitch * Math.PI) / 180,
    roll: (state.roll * Math.PI) / 180,
  })
  if (state.rig) drawRig(surface, res.head, res.genome)
  if (state.paper) surface.paperTexture({ opacity: 0.045, rng: () => rng.next() })
  $('desc').textContent = describe(res.genome)
}

// ---------------------------------------------------------------- export

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportPNG(): void {
  stage.toBlob((b) => {
    if (b) download(b, `naives-${state.tab}-${state.seed}.png`)
  }, 'image/png')
}

function exportSVG(): void {
  const size = sizeFor()
  const scale = state.tab === 'plate' ? 2 : 2      // crisper vector page
  const s = new SVGSurface({ width: size.w * scale, height: size.h * scale, background: '#efe9dd' })
  if (state.paper) s.paperTexture({ opacity: 0.28 })

  if (state.tab === 'plate') {
    renderPlate(s, {
      cols: state.cols, rows: state.rows, seed: state.seed,
      turn: (state.turn * Math.PI) / 180, tilt: (state.tilt * Math.PI) / 180, lean: 0.05,
      paper: false,
    })
  } else if (state.tab === 'turn') {
    const g = makeGenome(state.seed, traits())
    const cols = Math.min(state.frames, 5)
    const cell = (size.w * scale) / cols
    for (let i = 0; i < state.frames; i++) {
      const t = state.frames === 1 ? 0 : i / (state.frames - 1)
      const sweep = (state.sweep * Math.PI) / 180
      renderFace(s, {
        genome: g,
        cx: cell * (0.5 + (i % cols)),
        cy: cell * (0.5 + Math.floor(i / cols)),
        scale: cell * 0.3,
        yaw: -sweep / 2 + sweep * t,
        pitch: Math.sin(t * Math.PI * 2) * 0.12,
        backdrop: false,
      })
    }
  } else {
    renderFace(s, {
      seed: state.seed, traits: traits(),
      cx: (size.w * scale) / 2, cy: (size.h * scale) / 2,
      scale: Math.min(size.w, size.h) * scale * 0.3,
      yaw: (state.yaw * Math.PI) / 180,
      pitch: (state.pitch * Math.PI) / 180,
      roll: (state.roll * Math.PI) / 180,
    })
  }
  download(new Blob([s.toString()], { type: 'image/svg+xml' }), `naives-${state.tab}-${state.seed}.svg`)
}

// ------------------------------------------------------------------- UI

const CATEGORIES = {
  eyes, nose: noses, mouth: mouths, brow: brows, ears,
  hair, hat: hats, beard: facialHair, backdrop: backdrops,
}

function buildPickers(): void {
  const host = $('pickers')
  for (const [cat, mod] of Object.entries(CATEGORIES)) {
    const label = document.createElement('label')
    label.innerHTML = `<span style="font-size:11px;color:var(--ink-soft)">${cat}</span>`
    const sel = document.createElement('select')
    sel.innerHTML = '<option value="">— from seed —</option>'
      + Object.keys(mod).map((k) => `<option>${k}</option>`).join('')
    sel.addEventListener('change', () => {
      state.pinned[cat] = sel.value
      draw()
    })
    label.appendChild(sel)
    host.appendChild(label)
  }
}

/** The numeric slider-backed slots of `state`. */
type RangeKey = {
  [K in keyof State]: State[K] extends number ? K : never
}[keyof State]

function bindRange(id: string, key: RangeKey, fmt: (v: string) => string = (v) => v): void {
  const el = $<HTMLInputElement>(id)
  const out = $(`${id}Out`)
  const sync = () => {
    state[key] = Number(el.value)
    if (out) out.textContent = fmt(el.value)
  }
  el.addEventListener('input', () => {
    sync(); draw()
  })
  sync()
}

function showTab(tab: Tab): void {
  state.tab = tab
  for (const b of document.querySelectorAll<HTMLElement>('#tabs button')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab))
  }
  for (const fs of document.querySelectorAll<HTMLElement>('fieldset[data-for]')) {
    fs.hidden = !fs.dataset.for!.split(' ').includes(tab)
  }
  draw()
  // On a phone the canvas sits below the controls, so a tab change would
  // otherwise redraw something the reader cannot see.
  if (narrow()) stage.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

for (const b of document.querySelectorAll<HTMLElement>('#tabs button')) {
  b.addEventListener('click', () => showTab(b.dataset.tab as Tab))
}

$<HTMLInputElement>('seed').addEventListener('input', (e) => {
  state.seed = (e.currentTarget as HTMLInputElement).value || 'naives'; draw()
})
$('reroll').addEventListener('click', () => {
  state.seed = Math.random().toString(36).slice(2, 9)
  $<HTMLInputElement>('seed').value = state.seed
  draw()
})
$('png').addEventListener('click', exportPNG)
$('svg').addEventListener('click', exportSVG)
$('paper').addEventListener('change', (e) => {
  state.paper = (e.currentTarget as HTMLInputElement).checked; draw()
})
$('spin').addEventListener('change', (e) => {
  state.spin = (e.currentTarget as HTMLInputElement).checked
})
$('rig').addEventListener('change', (e) => {
  state.rig = (e.currentTarget as HTMLInputElement).checked; draw()
})

if (narrow()) {                    // legible defaults on a small screen
  $<HTMLInputElement>('cols').value = '3'
  $<HTMLInputElement>('rows').value = '5'
}
bindRange('cols', 'cols')
bindRange('rows', 'rows')
bindRange('turn', 'turn')
bindRange('tilt', 'tilt')
bindRange('yaw', 'yaw', (v) => `${v}°`)
bindRange('pitch', 'pitch', (v) => `${v}°`)
bindRange('roll', 'roll', (v) => `${v}°`)
bindRange('frames', 'frames')
bindRange('sweep', 'sweep')
buildPickers()

// ------------------------------------------------------- drag to rotate

interface Drag {
  x: number
  y: number
  yaw: number
  pitch: number
}

let drag: Drag | null = null
stage.addEventListener('pointerdown', (e) => {
  if (state.tab === 'plate') {
    // Click a face to inspect it in 3D.
    const rect = stage.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * state.logical.w
    const y = ((e.clientY - rect.top) / rect.height) * state.logical.h
    let best: PlateCell | null = null, bd = Infinity
    for (const f of state.plateFaces) {
      const d = (f.cx - x) ** 2 + (f.cy - y) ** 2
      if (d < bd) {
        bd = d; best = f
      }
    }
    if (best && bd < (best.scale * 1.6) ** 2) {
      state.seed = best.seed
      $<HTMLInputElement>('seed').value = best.seed
      showTab('head')
    }

    return
  }
  drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }
  stage.classList.add('dragging')
  stage.setPointerCapture(e.pointerId)
})

stage.addEventListener('pointermove', (e) => {
  if (!drag) return
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  state.yaw = clamp(drag.yaw + (e.clientX - drag.x) * 0.4, -90, 90)
  state.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.25, -40, 40)
  $<HTMLInputElement>('yaw').value = String(Math.round(state.yaw))
  $<HTMLInputElement>('pitch').value = String(Math.round(state.pitch))
  $('yawOut').textContent = `${Math.round(state.yaw)}°`
  $('pitchOut').textContent = `${Math.round(state.pitch)}°`
  draw()
})

const endDrag = () => {
  drag = null; stage.classList.remove('dragging')
}
stage.addEventListener('pointerup', endDrag)
stage.addEventListener('pointercancel', endDrag)

// --------------------------------------------------------------- ticking

let t0 = performance.now()
function frame(now: number): void {
  if (state.spin && state.tab === 'head') {
    if (now - t0 > 70) {
      t0 = now
      state.yaw = Math.round(Math.sin(now / 2200) * 72)
      state.pitch = Math.round(Math.sin(now / 3700) * 16)
      $<HTMLInputElement>('yaw').value = String(state.yaw)
      $<HTMLInputElement>('pitch').value = String(state.pitch)
      $('yawOut').textContent = `${state.yaw}°`
      $('pitchOut').textContent = `${state.pitch}°`
      draw()
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

let resizeTimer: ReturnType<typeof setTimeout> | undefined
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(draw, 120)
}
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)

showTab('plate')
