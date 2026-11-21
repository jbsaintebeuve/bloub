import { r2 } from './math'
import { capsulePath, type Point } from './shape'

/**
 * Géométrie des yeux : la gélule (pilule) et l'arc heureux, fondus l'un dans
 * l'autre POINT PAR POINT.
 *
 * C'est le cœur d'open-bot-avatar 0.3.0 (`packages/core/src/eyes.ts`, MIT,
 * © 2026 Dominik Scholz, revu au commit 5e64c08) : la pilule et l'arc sont
 * chacun échantillonnés en un contour fermé parti du sommet, dans le sens
 * horaire, au même nombre de points ; mélanger les points deux à deux donne
 * toutes les formes intermédiaires, donc un changement d'expression MORPHE
 * les yeux au lieu de les échanger.
 *
 * Le repère est celui de l'œil local, centré sur l'origine : x = axe court de
 * la gélule, y = axe long. C'est la matrice rendue par le moteur qui pose
 * ensuite ce contour sur la sphère (et c'est elle aussi qui écrase
 * verticalement au clignement, donc le clignement s'applique à l'arc comme à
 * la gélule, et il anime l'export SVG qui ne transporte que les matrices).
 *
 * La gélule pure garde `capsulePath` au byte près : le rendu pilule existant
 * ne bouge pas. L'arc pur (`arc >= 1`) est un contour unique, toujours le
 * même : l'export SVG animé fige le `d` de la première image et n'anime que
 * les matrices, donc l'expression pure doit porter son outline dans le `d`.
 */

/**
 * Arc heureux, en fractions de la taille de l'œil (w = largeur, h = hauteur) :
 * une quadratique de (±halfWidth·w, base·h) passant par le contrôle
 * (0, −peak·h), bordée d'un trait de `stroke`·w à bouts ronds. Identique à
 * `HAPPY_ARC` d'OBA (`validate.ts`).
 */
export const ARC_HEUREUX = { halfWidth: 0.72, base: 0.1, peak: 0.42, stroke: 0.6 } as const

/** Points par contour. */
const STEPS = 40

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** `count` points à pas égaux le long d'un polygone fermé, le premier sur son premier point. */
function resample(pts: Point[], count: number): Point[] {
  const n = pts.length
  const at: number[] = [0]
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    at.push(at[i]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = at[n]!
  const out: Point[] = []
  let i = 0
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total
    while (i < n - 1 && at[i + 1]! < s) i++
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const u = at[i + 1]! > at[i]! ? (s - at[i]!) / (at[i + 1]! - at[i]!) : 0
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
  }
  return out
}

/** Un arc de cercle en points, de l'angle `from` à `to` (radians, y vers le bas), extrémités incluses. */
function sweep(cx: number, cy: number, r: number, from: number, to: number, steps: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

/** La pilule : un stade de `w` sur `h` centré en (cx, cy), parti du sommet, horaire. */
function pilule(cx: number, cy: number, w: number, h: number): Point[] {
  const r = Math.min(w, h) / 2
  const fx = w / 2 - r
  const fy = h / 2 - r
  const q = Math.PI / 2
  return [
    { x: cx, y: cy - h / 2 },
    ...sweep(cx + fx, cy - fy, r, -q, 0, 6),
    ...sweep(cx + fx, cy + fy, r, 0, q, 6),
    ...sweep(cx - fx, cy + fy, r, q, 2 * q, 6),
    ...sweep(cx - fx, cy - fy, r, 2 * q, 3 * q, 6)
  ]
}

/**
 * La ligne médiane de l'arc heureux, en repère local : la quadratique de
 * (−halfWidth·w, base·h) à (+halfWidth·w, base·h) par le contrôle (0, −peak·h).
 * Échantillonnée, elle sert d'axe à l'empreinte d'`eyefit` (l'arc épais en est
 * le trait bordé d'un disque de rayon `stroke`·w / 2).
 */
export function centreArc(w: number, h: number, echantillons = 12): Point[] {
  const hw = w * ARC_HEUREUX.halfWidth
  const base = h * ARC_HEUREUX.base
  const peak = -h * ARC_HEUREUX.peak
  const pts: Point[] = []
  for (let i = 0; i <= echantillons; i++) {
    const s = i / echantillons
    const m = 1 - s
    pts.push({
      x: hw * (2 * s - 1),
      y: (m * m + s * s) * base + 2 * m * s * peak
    })
  }
  return pts
}

/**
 * Le contour de l'arc épais, local : les deux bords du trait et ses bouts
 * ronds, parti du sommet, horaire. Porté tel quel d'OBA.
 */
function arcHeureux(w: number, h: number): Point[] {
  const hw = w * ARC_HEUREUX.halfWidth
  const base = h * ARC_HEUREUX.base
  const peak = -h * ARC_HEUREUX.peak
  const r = (w * ARC_HEUREUX.stroke) / 2
  // La ligne médiane et sa normale vers le haut en s (0 = bout gauche, 1 = bout droit).
  const at = (s: number): { p: Point; n: Point } => {
    const m = 1 - s
    const x = hw * (2 * s - 1)
    const y = (m * m + s * s) * base + 2 * m * s * peak
    const tx = 2 * hw
    const ty = 2 * (2 * s - 1) * (base - peak)
    const len = Math.hypot(tx, ty)
    return { p: { x, y }, n: { x: ty / len, y: -tx / len } }
  }
  const edge = (from: number, to: number, side: 1 | -1): Point[] => {
    const pts: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const { p, n } = at(from + ((to - from) * i) / 8)
      pts.push({ x: p.x + n.x * r * side, y: p.y + n.y * r * side })
    }
    return pts
  }
  const end = (s: 0 | 1): Point[] => {
    const { p, n } = at(s)
    const up = Math.atan2(n.y, n.x)
    // Le bout rond, de son bord supérieur à son bord inférieur, par sa pointe.
    return s === 1
      ? sweep(p.x, p.y, r, up, up + Math.PI, 8)
      : sweep(p.x, p.y, r, up + Math.PI, up + 2 * Math.PI, 8)
  }
  return [...edge(0.5, 1, 1), ...end(1), ...edge(1, 0, -1), ...end(0), ...edge(0, 0.5, 1)]
}

/**
 * Le contour fermé d'un œil, en repère local, parti du sommet et horaire : la
 * pilule et l'arc mélangés point par point selon `arc` (0 = pilule, 1 = arc).
 */
export function contourOeil(w: number, h: number, arc = 0): Point[] {
  const a = clamp(arc, 0, 1)
  const formes: Array<[number, Point[]]> = [
    [1 - a, pilule(0, 0, w, h)],
    [a, arcHeureux(w, h)]
  ]
  const out: Point[] = Array.from({ length: STEPS }, () => ({ x: 0, y: 0 }))
  for (const [poids, forme] of formes) {
    if (poids <= 0) continue
    resample(forme, STEPS).forEach((p, i) => {
      out[i]!.x += p.x * poids
      out[i]!.y += p.y * poids
    })
  }
  return out
}

/** Un chemin fermé lisse passant par un contour : une quadratique par point, jointes aux milieux. M, Q et Z absolus. */
export function cheminContour(pts: Point[]): string {
  const n = pts.length
  const mid = (i: number): Point => {
    const a = pts[i % n]!
    const b = pts[(i + 1) % n]!
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
  const depart = mid(n - 1)
  let d = `M${r2(depart.x)} ${r2(depart.y)}`
  for (let i = 0; i < n; i++) {
    const m = mid(i)
    d += `Q${r2(pts[i]!.x)} ${r2(pts[i]!.y)} ${r2(m.x)} ${r2(m.y)}`
  }
  return `${d}Z`
}

/** La gélule d’origine et le contour interpolé utilisent le même repère. */
export function cheminOeil(w: number, h: number, arc = 0): string {
  if (arc <= 0) return capsulePath(w, h)
  return cheminContour(contourOeil(w, h, arc))
}
