/**
 * naives for Vue 3.
 *
 *   import { Face, Plate, useTurntable } from 'naives/vue'
 *
 *   <Face seed="ada" :yaw="30" :width="280" />
 *
 * `vue` is a peer dependency: nothing here is pulled into the core library.
 */

import { computed, defineComponent, h, onMounted, ref, shallowRef, toValue, watch } from 'vue'

import {
  drawFaceOnCanvas, drawPlateOnCanvas, faceSVG, faceSize, pickFace,
  plateSVG, plateSize,
} from '../integrations/core'
import { describe } from '../genome'

import type { ComputedRef, MaybeRefOrGetter, PropType, Ref } from 'vue'
import type { FaceOptions, PlateOptions } from '../integrations/core'
import type { Genome, Overrides } from '../types'
import type { PlateCell } from '../plate'
import type { Seed } from '../rng'

export type { FaceOptions, PlateOptions } from '../integrations/core'

// -------------------------------------------------------------- composables

export interface UseFaceResult {
  svg: ComputedRef<string>
  genome: ComputedRef<Genome>
  /** A one-line summary -- good alt text. */
  description: ComputedRef<string>
}

/**
 * One face as SVG. Pass refs, a getter, or a plain object -- anything
 * reactive re-renders, and nothing else recomputes.
 */
export function useFace(options: MaybeRefOrGetter<FaceOptions> = {}): UseFaceResult {
  const result = computed(() => faceSVG(toValue(options)))

  return {
    svg: computed(() => result.value.svg),
    genome: computed(() => result.value.genome),
    description: computed(() => describe(result.value.genome)),
  }
}

export interface UsePlateResult {
  svg: ComputedRef<string>
  faces: ComputedRef<PlateCell[]>
}

/** A grid of faces as SVG, plus where each face landed. */
export function usePlate(options: MaybeRefOrGetter<PlateOptions> = {}): UsePlateResult {
  const result = computed(() => plateSVG(toValue(options)))

  return {
    svg: computed(() => result.value.svg),
    faces: computed(() => result.value.faces),
  }
}

export interface TurntableOptions {
  yaw?: number
  pitch?: number
  /** Degrees of turn per pixel dragged. */
  sensitivity?: number
  maxYaw?: number
  maxPitch?: number
}

export interface Turntable {
  yaw: Ref<number>
  pitch: Ref<number>
  dragging: Ref<boolean>
  reset: () => void
  /** `v-bind` this onto the element that should respond to dragging. */
  bind: ComputedRef<Record<string, unknown>>
}

/** Drag-to-turn, in the units `<Face>` takes. */
export function useTurntable(options: TurntableOptions = {}): Turntable {
  const { yaw: yaw0 = 0, pitch: pitch0 = 0, sensitivity = 0.4, maxYaw = 90, maxPitch = 40 } = options
  const yaw = ref(yaw0)
  const pitch = ref(pitch0)
  const dragging = ref(false)
  let from: { x: number, y: number, yaw: number, pitch: number } | null = null

  const onPointerdown = (e: PointerEvent) => {
    from = { x: e.clientX, y: e.clientY, yaw: yaw.value, pitch: pitch.value }
    dragging.value = true;
    (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId)
  }
  const onPointermove = (e: PointerEvent) => {
    if (!from) return
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
    yaw.value = clamp(from.yaw + (e.clientX - from.x) * sensitivity, maxYaw)
    pitch.value = clamp(from.pitch - (e.clientY - from.y) * sensitivity * 0.625, maxPitch)
  }
  const end = () => {
    from = null; dragging.value = false
  }

  return {
    yaw,
    pitch,
    dragging,
    reset: () => {
      yaw.value = yaw0; pitch.value = pitch0
    },
    bind: computed(() => ({
      onPointerdown,
      onPointermove,
      onPointerup: end,
      onPointercancel: end,
      style: { cursor: dragging.value ? 'grabbing' : 'grab', touchAction: 'none' },
    })),
  }
}

// -------------------------------------------------------------- components

const faceProps = {
  seed: { type: [String, Number] as PropType<Seed>, default: 'naives' },
  genome: { type: Object as PropType<Genome | null>, default: null },
  traits: { type: Object as PropType<Overrides>, default: undefined },
  /** Degrees. */
  yaw: { type: Number, default: 0 },
  pitch: { type: Number, default: 0 },
  roll: { type: Number, default: 0 },
  width: { type: Number, default: undefined },
  height: { type: Number, default: undefined },
  scale: { type: Number, default: undefined },
  background: { type: String as PropType<string | null>, default: null },
  paper: { type: [Boolean, Number] as PropType<boolean | number>, default: undefined },
  backdrop: { type: Boolean, default: true },
  rough: { type: Number, default: 1 },
  focal: { type: Number, default: 7 },
  rig: { type: Boolean, default: false },
  /**
   * `svg` inlines a vector drawing and works during server rendering;
   * `canvas` paints, which is cheaper to re-run every frame.
   */
  as: { type: String as PropType<'svg' | 'canvas'>, default: 'svg' },
  /** Overrides the generated description used as the accessible label. */
  label: { type: String, default: undefined },
} as const

/** Everything the renderer cares about, with the presentation props removed. */
const pickFaceOptions = (p: Record<string, unknown>): FaceOptions => ({
  seed: p.seed as Seed,
  genome: p.genome as Genome | null,
  traits: p.traits as Overrides | undefined,
  yaw: p.yaw as number,
  pitch: p.pitch as number,
  roll: p.roll as number,
  width: p.width as number | undefined,
  height: p.height as number | undefined,
  scale: p.scale as number | undefined,
  background: p.background as string | null,
  paper: p.paper as boolean | number | undefined,
  backdrop: p.backdrop as boolean,
  rough: p.rough as number,
  focal: p.focal as number,
  rig: p.rig as boolean,
})

/**
 * One doodle face.
 *
 *   <Face seed="ada" :yaw="30" />
 *   <Face seed="ada" as="canvas" :traits="{ nose: 'hook' }" />
 */
export const Face = defineComponent({
  name: 'NaivesFace',
  props: faceProps,
  emits: {
    genome: (g: Genome) => !!g,
  },
  setup(props, { emit }) {
    const options = computed(() => pickFaceOptions(props))
    const canvas = ref<HTMLCanvasElement | null>(null)
    const painted = shallowRef<Genome | null>(null)

    const svg = computed(() => (props.as === 'svg' ? faceSVG(options.value) : null))
    watch(svg, (v) => {
      if (v) emit('genome', v.genome)
    }, { immediate: true })

    const paint = () => {
      if (props.as !== 'canvas' || !canvas.value) return
      const res = drawFaceOnCanvas(canvas.value, options.value)
      if (res) {
        painted.value = res.genome
        emit('genome', res.genome)
      }
    }
    onMounted(paint)
    watch(options, paint)
    watch(() => props.as, paint)

    return () => {
      const size = faceSize(options.value)
      if (props.as === 'canvas') {
        return h('canvas', {
          ref: canvas,
          role: 'img',
          'aria-label': props.label
            ?? (painted.value ? describe(painted.value) : 'a doodle face'),
          style: { width: `${size.width}px`, height: `${size.height}px` },
        })
      }

      return h('div', {
        role: 'img',
        'aria-label': props.label ?? describe(svg.value!.genome),
        style: { display: 'inline-block', lineHeight: 0 },
        innerHTML: svg.value!.svg,
      })
    }
  },
})

const plateProps = {
  cols: { type: Number, default: 6 },
  rows: { type: Number, default: 8 },
  seed: { type: [String, Number] as PropType<Seed>, default: 'plate' },
  traits: { type: Object as PropType<Overrides>, default: undefined },
  /** Degrees: the widest each face may turn, tilt and lean. */
  turn: { type: Number, default: 0 },
  tilt: { type: Number, default: 0 },
  lean: { type: Number, default: 3 },
  width: { type: Number, default: undefined },
  height: { type: Number, default: undefined },
  scaleFactor: { type: Number, default: 0.3 },
  background: { type: String as PropType<string | null>, default: null },
  paper: { type: [Boolean, Number] as PropType<boolean | number>, default: undefined },
  rough: { type: Number, default: 1 },
  as: { type: String as PropType<'svg' | 'canvas'>, default: 'svg' },
  label: { type: String, default: undefined },
} as const

const pickPlateOptions = (p: Record<string, unknown>): PlateOptions => ({
  cols: p.cols as number,
  rows: p.rows as number,
  seed: p.seed as Seed,
  traits: p.traits as Overrides | undefined,
  turn: p.turn as number,
  tilt: p.tilt as number,
  lean: p.lean as number,
  width: p.width as number | undefined,
  height: p.height as number | undefined,
  scaleFactor: p.scaleFactor as number,
  background: p.background as string | null,
  paper: p.paper as boolean | number | undefined,
  rough: p.rough as number,
})

/**
 * A sheet of faces.
 *
 *   <Plate :cols="6" :rows="8" seed="monday" @select="f => seed = f.seed" />
 */
export const Plate = defineComponent({
  name: 'NaivesPlate',
  props: plateProps,
  emits: {
    select: (cell: PlateCell) => !!cell,
    faces: (cells: PlateCell[]) => Array.isArray(cells),
  },
  setup(props, { emit }) {
    const options = computed(() => pickPlateOptions(props))
    const canvas = ref<HTMLCanvasElement | null>(null)
    const painted = shallowRef<PlateCell[]>([])

    const svg = computed(() => (props.as === 'svg' ? plateSVG(options.value) : null))
    const faces = computed(() => svg.value?.faces ?? painted.value)
    watch(faces, (v) => {
      if (v.length) emit('faces', v)
    }, { immediate: true })

    const paint = () => {
      if (props.as !== 'canvas' || !canvas.value) return
      painted.value = drawPlateOnCanvas(canvas.value, options.value)
    }
    onMounted(paint)
    watch(options, paint)
    watch(() => props.as, paint)

    const onClick = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement
      const { width, height } = plateSize(options.value)
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / (rect.width || 1)) * width
      const y = ((e.clientY - rect.top) / (rect.height || 1)) * height
      const hit = pickFace(faces.value, x, y)
      if (hit) emit('select', hit)
    }

    return () => {
      const { width, height } = plateSize(options.value)
      const label = props.label ?? `${faces.value.length} doodle faces`
      if (props.as === 'canvas') {
        return h('canvas', {
          ref: canvas,
          role: 'img',
          'aria-label': label,
          style: { width: `${width}px`, height: `${height}px`, cursor: 'pointer' },
          onClick,
        })
      }

      return h('div', {
        role: 'img',
        'aria-label': label,
        style: { display: 'inline-block', lineHeight: 0, cursor: 'pointer' },
        innerHTML: svg.value!.svg,
        onClick,
      })
    }
  },
})

/** Convenience helper: the same SVG string the component would render. */
export { faceSVG, plateSVG, pickFace, pointerToCanvas } from '../integrations/core'
