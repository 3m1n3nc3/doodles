/**
 * naives for React.
 *
 *   import { Face, Plate, useTurntable } from 'naives/react'
 *
 *   <Face seed="ada" yaw={30} width={280} />
 *
 * `react` is a peer dependency: nothing here is pulled into the core library.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  drawFaceOnCanvas, drawPlateOnCanvas, faceSVG, faceSize, pickFace,
  plateSVG, plateSize,
} from '../integrations/core'
import { describe } from '../genome'

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import type { FaceOptions, PlateOptions } from '../integrations/core'
import type { Genome } from '../types'
import type { PlateCell } from '../plate'

export type { FaceOptions, PlateOptions } from '../integrations/core'

/**
 * Options are a fresh object on every render, so memos key on their *content*
 * instead. Round-tripping through the key -- rather than closing over the
 * original object -- is what keeps the dependency arrays honest: the key is
 * the only thing the work depends on, so it is the only thing listed.
 *
 * A genome is passed alongside rather than serialised, because it carries a
 * function (the hairline) and is cheap to compare by identity.
 */
function optionKey(o: object): string {
  return JSON.stringify(o)
}

function splitOptions<T extends { genome?: Genome | null }>(o: T): [string, Genome | null] {
  const { genome = null, ...rest } = o

  return [optionKey(rest), genome]
}

// ------------------------------------------------------------------- hooks

export interface UseFaceResult {
  svg: string
  genome: Genome
  /** A one-line summary -- good alt text. */
  description: string
}

/** One face as SVG, recomputed only when something about it actually changes. */
export function useFace(options: FaceOptions = {}): UseFaceResult {
  const [key, given] = splitOptions(options)

  return useMemo(() => {
    const { svg, genome } = faceSVG({ ...JSON.parse(key) as FaceOptions, genome: given })

    return { svg, genome, description: describe(genome) }
  }, [key, given])
}

export interface UsePlateResult {
  svg: string
  faces: PlateCell[]
}

/** A grid of faces as SVG, plus where each face landed. */
export function usePlate(options: PlateOptions = {}): UsePlateResult {
  const key = optionKey(options)

  return useMemo(() => plateSVG(JSON.parse(key) as PlateOptions), [key])
}

export interface Turntable {
  yaw: number
  pitch: number
  setYaw: (v: number) => void
  setPitch: (v: number) => void
  reset: () => void
  dragging: boolean
  /** Spread onto the element that should respond to dragging. */
  bind: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
    onPointerCancel: (e: ReactPointerEvent) => void
    style: CSSProperties
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

/** Drag-to-turn, in the units `<Face>` takes. */
export function useTurntable(options: TurntableOptions = {}): Turntable {
  const { yaw: yaw0 = 0, pitch: pitch0 = 0, sensitivity = 0.4, maxYaw = 90, maxPitch = 40 } = options
  const [yaw, setYaw] = useState(yaw0)
  const [pitch, setPitch] = useState(pitch0)
  const [dragging, setDragging] = useState(false)
  const from = useRef<{ x: number, y: number, yaw: number, pitch: number } | null>(null)

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    from.current = { x: e.clientX, y: e.clientY, yaw, pitch }
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [yaw, pitch])

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const f = from.current
    if (!f) return
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
    setYaw(clamp(f.yaw + (e.clientX - f.x) * sensitivity, maxYaw))
    setPitch(clamp(f.pitch - (e.clientY - f.y) * sensitivity * 0.625, maxPitch))
  }, [sensitivity, maxYaw, maxPitch])

  const end = useCallback(() => {
    from.current = null; setDragging(false)
  }, [])

  const reset = useCallback(() => {
    setYaw(yaw0); setPitch(pitch0)
  }, [yaw0, pitch0])

  return {
    yaw, pitch, setYaw, setPitch, reset, dragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      style: { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' },
    },
  }
}

// -------------------------------------------------------------- components

export interface FaceProps extends FaceOptions {
  /**
   * `svg` inlines a vector drawing and works during server rendering;
   * `canvas` paints, which is cheaper to re-run every frame.
   */
  as?: 'svg' | 'canvas'
  className?: string
  style?: CSSProperties
  /** Overrides the generated description used as the accessible label. */
  label?: string
  onGenome?: (genome: Genome) => void
}

/**
 * One doodle face.
 *
 *   <Face seed="ada" yaw={30} />
 *   <Face seed="ada" as="canvas" traits={{ nose: 'hook' }} />
 */
export function Face(props: FaceProps): ReactElement {
  const { as = 'svg', className, style, label, onGenome, ...options } = props

  return as === 'canvas'
    ? <CanvasFace {...{ className, style, label, onGenome, options }} />
    : <SVGFace {...{ className, style, label, onGenome, options }} />
}

interface InnerProps {
  className?: string
  style?: CSSProperties
  label?: string
  onGenome?: (genome: Genome) => void
  options: FaceOptions
}

function SVGFace({ className, style, label, onGenome, options }: InnerProps): ReactElement {
  const { svg, genome, description } = useFace(options)
  useReport(onGenome, genome)

  return (
    <div
      className={className}
      style={{ display: 'inline-block', lineHeight: 0, ...style }}
      role="img"
      aria-label={label ?? description}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function CanvasFace({ className, style, label, onGenome, options }: InnerProps): ReactElement {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [genome, setGenome] = useState<Genome | null>(null)
  const [key, given] = splitOptions(options)

  useEffect(() => {
    if (!ref.current) return
    const res = drawFaceOnCanvas(ref.current, { ...JSON.parse(key) as FaceOptions, genome: given })
    if (res) setGenome(res.genome)
  }, [key, given])

  useReport(onGenome, genome)
  const { width, height } = faceSize(options)

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height, ...style }}
      role="img"
      aria-label={label ?? (genome ? describe(genome) : 'a doodle face')}
    />
  )
}

export interface PlateProps extends PlateOptions {
  as?: 'svg' | 'canvas'
  className?: string
  style?: CSSProperties
  label?: string
  /** Fires with the face that was clicked, or nothing if it was a gutter. */
  onSelect?: (cell: PlateCell) => void
  onFaces?: (faces: PlateCell[]) => void
}

/**
 * A sheet of faces.
 *
 *   <Plate cols={6} rows={8} seed="monday" onSelect={(f) => setSeed(f.seed)} />
 */
export function Plate(props: PlateProps): ReactElement {
  const { as = 'svg', className, style, label, onSelect, onFaces, ...options } = props
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [canvasFaces, setCanvasFaces] = useState<PlateCell[]>([])
  const key = optionKey(options)
  const { width, height } = plateSize(options)

  const svgResult = useMemo(
    () => (as === 'svg' ? plateSVG(JSON.parse(key) as PlateOptions) : null),
    [key, as])

  useEffect(() => {
    if (as !== 'canvas' || !ref.current) return
    setCanvasFaces(drawPlateOnCanvas(ref.current, JSON.parse(key) as PlateOptions))
  }, [key, as])

  const faces = svgResult ? svgResult.faces : canvasFaces
  useReport(onFaces, faces.length ? faces : null)

  const select = useCallback((clientX: number, clientY: number, el: HTMLElement) => {
    if (!onSelect) return
    const rect = el.getBoundingClientRect()
    const x = ((clientX - rect.left) / (rect.width || 1)) * width
    const y = ((clientY - rect.top) / (rect.height || 1)) * height
    const hit = pickFace(faces, x, y)
    if (hit) onSelect(hit)
  }, [onSelect, faces, width, height])

  if (as === 'canvas') {
    return (
      <canvas
        ref={ref}
        className={className}
        style={{ width, height, cursor: onSelect ? 'pointer' : undefined, ...style }}
        role="img"
        aria-label={label ?? `${faces.length} doodle faces`}
        onClick={(e) => select(e.clientX, e.clientY, e.currentTarget)}
      />
    )
  }

  return (
    <div
      className={className}
      style={{ display: 'inline-block', lineHeight: 0, cursor: onSelect ? 'pointer' : undefined, ...style }}
      role="img"
      aria-label={label ?? `${faces.length} doodle faces`}
      onClick={(e) => select(e.clientX, e.clientY, e.currentTarget)}
      dangerouslySetInnerHTML={{ __html: svgResult?.svg ?? '' }}
    />
  )
}

/** Hand a value back to the parent after paint, never during render. */
function useReport<T>(fn: ((v: T) => void) | undefined, value: T | null): void {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    if (value != null) latest.current?.(value)
  }, [value])
}

/** Convenience helper: the same SVG string the component would render. */
export { faceSVG, plateSVG, pickFace, pointerToCanvas } from '../integrations/core'
