/**
 * Parseur et aplatisseur de chemin SVG RESTRAINTS, pour l'import d'avatars.
 *
 * Adapte `packages/core/src/path.ts` du projet open-bot-avatar (MIT, © 2026
 * Dominik Scholz, https://github.com/dominikscholz/open-bot-avatar, revu au
 * commit 5e64c08) : tokeniseur, normalisation absolue, bornes de ressources et
 * aplatissement en polygones y sont repris presque tels quels. Deux ecarts
 * assumes : les messages sont en anglais (ils nourrissent le prompt de
 * reparation adresse a un agent) et l'aplatissement est plafonne plus bas
 * (32 cordes par courbe, FLATNESS 0.05) — l'import doit rester borne en
 * ressources, la fidelite au quart de pixel n'est pas en jeu.
 *
 * Le resultat est RESERIALISE depuis des nombres : le texte du modele n'est
 * jamais renvoye tel quel dans un rendu. Bloub n'injecte d'ailleurs rien de ce
 * chemin dans le DOM : il n'en garde au final que 64 rayons.
 */

export type Segment =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'A'; rx: number; ry: number; rot: number; large: 0 | 1; sweep: 0 | 1; x: number; y: number }
  | { c: 'Z' }

export type Point = [number, number]

/** Bornes de ressources : celles du contrat v1 d'open-bot-avatar. */
export const LIMITES_CHEMIN = {
  maxCars: 6000,
  maxSegments: 400,
  maxSousChemins: 16,
  coordMin: -20,
  coordMax: 120
} as const

const ARG_NOMBRE: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

export class ErreurChemin extends Error {}

function tokenise(d: string): (string | number)[] {
  if (/[^MmLlHhVvCcSsQqTtAaZz0-9.,eE+\-\s]/.test(d)) {
    const bad = d.match(/[^MmLlHhVvCcSsQqTtAaZz0-9.,eE+\-\s]/)![0]
    throw new ErreurChemin(`unsupported character ${JSON.stringify(bad)} (allowed commands: M L H V C S Q T A Z)`)
  }
  const jetons: (string | number)[] = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([\s,]+)/y
  let i = 0
  while (i < d.length) {
    re.lastIndex = i
    const m = re.exec(d)
    if (!m) throw new ErreurChemin(`cannot parse path near ${JSON.stringify(d.slice(i, i + 12))}`)
    if (m[1]) jetons.push(m[1])
    else if (m[2]) jetons.push(Number(m[2]))
    i = re.lastIndex
  }
  return jetons
}

/** Analyse et convertit en segments absolus M/L/C/Q/A/Z. Jette `ErreurChemin`. */
export function parseChemin(d: string): Segment[] {
  if (typeof d !== 'string' || d.trim() === '') throw new ErreurChemin('path is empty')
  if (d.length > LIMITES_CHEMIN.maxCars) throw new ErreurChemin(`path longer than ${LIMITES_CHEMIN.maxCars} characters`)
  const jetons = tokenise(d)
  const out: Segment[] = []
  let i = 0
  let cx = 0, cy = 0, sx = 0, sy = 0
  let prevC: [number, number] | null = null
  let prevQ: [number, number] | null = null
  let cmd = ''
  let sousChemins = 0
  let ouvert = false

  while (i < jetons.length) {
    const t = jetons[i]
    if (typeof t === 'string') {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') {
        if (!ouvert) throw new ErreurChemin('Z without an open subpath')
        out.push({ c: 'Z' })
        cx = sx; cy = sy; prevC = prevQ = null; ouvert = false
        continue
      }
    } else if (!cmd) {
      throw new ErreurChemin('path must start with M')
    } else if (cmd === 'Z' || cmd === 'z') {
      throw new ErreurChemin('numbers after Z')
    }
    const maj = cmd.toUpperCase()
    const rel = cmd !== maj
    if (out.length === 0 && maj !== 'M') throw new ErreurChemin('path must start with M')
    const n = ARG_NOMBRE[maj]!
    const args: number[] = []
    for (let k = 0; k < n; k++) {
      const v = jetons[i + k]
      if (typeof v !== 'number') throw new ErreurChemin(`command ${cmd} expects ${n} numbers`)
      if (!Number.isFinite(v)) throw new ErreurChemin('non-finite number')
      args.push(v)
    }
    i += n
    const ox = rel ? cx : 0, oy = rel ? cy : 0
    let nextC: [number, number] | null = null
    let nextQ: [number, number] | null = null
    switch (maj) {
      case 'M': {
        if (ouvert) out.push({ c: 'Z' })
        cx = args[0]! + ox; cy = args[1]! + oy; sx = cx; sy = cy
        out.push({ c: 'M', x: cx, y: cy })
        sousChemins++; ouvert = true
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L': cx = args[0]! + ox; cy = args[1]! + oy; out.push({ c: 'L', x: cx, y: cy }); break
      case 'H': cx = args[0]! + ox; out.push({ c: 'L', x: cx, y: cy }); break
      case 'V': cy = args[0]! + oy; out.push({ c: 'L', x: cx, y: cy }); break
      case 'C': {
        const s: Segment = { c: 'C', x1: args[0]! + ox, y1: args[1]! + oy, x2: args[2]! + ox, y2: args[3]! + oy, x: args[4]! + ox, y: args[5]! + oy }
        out.push(s); nextC = [s.x2, s.y2]; cx = s.x; cy = s.y
        break
      }
      case 'S': {
        const x1: number = prevC ? 2 * cx - prevC[0] : cx, y1: number = prevC ? 2 * cy - prevC[1] : cy
        const s: Segment = { c: 'C', x1, y1, x2: args[0]! + ox, y2: args[1]! + oy, x: args[2]! + ox, y: args[3]! + oy }
        out.push(s); nextC = [s.x2, s.y2]; cx = s.x; cy = s.y
        break
      }
      case 'Q': {
        const s: Segment = { c: 'Q', x1: args[0]! + ox, y1: args[1]! + oy, x: args[2]! + ox, y: args[3]! + oy }
        out.push(s); nextQ = [s.x1, s.y1]; cx = s.x; cy = s.y
        break
      }
      case 'T': {
        const x1: number = prevQ ? 2 * cx - prevQ[0] : cx, y1: number = prevQ ? 2 * cy - prevQ[1] : cy
        const s: Segment = { c: 'Q', x1, y1, x: args[0]! + ox, y: args[1]! + oy }
        out.push(s); nextQ = [x1, y1]; cx = s.x; cy = s.y
        break
      }
      case 'A': {
        const [rx, ry, rot, la, sw] = args as [number, number, number, number, number, number, number]
        if (rx < 0 || ry < 0) throw new ErreurChemin('arc radii must be non-negative')
        if ((la !== 0 && la !== 1) || (sw !== 0 && sw !== 1)) throw new ErreurChemin('arc flags must be 0 or 1, written as separate numbers')
        cx = args[5]! + ox; cy = args[6]! + oy
        out.push({ c: 'A', rx, ry, rot, large: la as 0 | 1, sweep: sw as 0 | 1, x: cx, y: cy })
        break
      }
      default:
        throw new ErreurChemin(`unsupported command ${cmd}`)
    }
    prevC = nextC; prevQ = nextQ
    if (out.length > LIMITES_CHEMIN.maxSegments) throw new ErreurChemin(`more than ${LIMITES_CHEMIN.maxSegments} segments`)
  }
  if (ouvert) out.push({ c: 'Z' })
  if (sousChemins > LIMITES_CHEMIN.maxSousChemins) throw new ErreurChemin(`more than ${LIMITES_CHEMIN.maxSousChemins} subpaths`)
  for (const s of out) {
    for (const [k, v] of Object.entries(s)) {
      if (k === 'c' || typeof v !== 'number') continue
      if (k === 'rot' || k === 'large' || k === 'sweep') continue
      if (v < LIMITES_CHEMIN.coordMin || v > LIMITES_CHEMIN.coordMax) throw new ErreurChemin(`coordinate ${v} far outside the 0..100 viewBox`)
    }
  }
  return out
}

/**
 * Ecart max, en unites viewBox, entre une courbe et le polygone qui la
 * represente. OBA vise 0.02 ; l'import retombe a 0.05 : des dents de scie
 * infimes ne changent rien a un profil de 64 rayons, et le plafond de cordes
 * par courbe garde le worst case borne.
 */
export const FLATNESS = 0.05

/** Plafond de cordes par courbe : la limite de RESSOURCES de l'aplatissement. */
const MAX_CORDES = 32

/** Point extremite d'arc -> points echantillonnes (SVG implementation notes, F.6.5). */
function echantillonneArc(x0: number, y0: number, s: Extract<Segment, { c: 'A' }>, out: Point[]): void {
  let { rx, ry } = s
  const { x, y } = s
  if (rx === 0 || ry === 0 || (x0 === x && y0 === y)) { out.push([x, y]); return }
  const phi = (s.rot * Math.PI) / 180
  const cos = Math.cos(phi), sin = Math.sin(phi)
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy
  rx = Math.abs(rx); ry = Math.abs(ry)
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) { const k = Math.sqrt(lambda); rx *= k; ry *= k }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  let coef = Math.sqrt(Math.max(0, num / den))
  if (s.large === s.sweep) coef = -coef
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!s.sweep && dt > 0) dt -= 2 * Math.PI
  if (s.sweep && dt < 0) dt += 2 * Math.PI
  // une corde sur un angle theta s'affaisse de r(1 - cos(theta/2))
  const pas = 2 * Math.acos(Math.max(-1, 1 - FLATNESS / Math.max(rx, ry)))
  const etapes = Math.min(256, Math.max(4, Math.ceil(Math.abs(dt) / pas)))
  for (let k = 1; k <= etapes; k++) {
    const t = t1 + (dt * k) / etapes
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t)
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy])
  }
}

/** Aplatit en polygones fermes, un par sous-chemin. */
export function aplatir(segs: Segment[]): Point[][] {
  const polys: Point[][] = []
  let cur: Point[] = []
  let px = 0, py = 0
  for (const s of segs) {
    switch (s.c) {
      case 'M':
        if (cur.length) polys.push(cur)
        cur = [[s.x, s.y]]; px = s.x; py = s.y
        break
      case 'L': cur.push([s.x, s.y]); px = s.x; py = s.y; break
      case 'C': {
        // borne de Wang : ce nombre de cordes tient la courbe a FLATNESS pres
        const m = Math.max(Math.hypot(px - 2 * s.x1 + s.x2, py - 2 * s.y1 + s.y2), Math.hypot(s.x1 - 2 * s.x2 + s.x, s.y1 - 2 * s.y2 + s.y))
        const n = Math.min(MAX_CORDES, Math.max(2, Math.ceil(Math.sqrt((0.75 * m) / FLATNESS))))
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t
          cur.push([
            u * u * u * px + 3 * u * u * t * s.x1 + 3 * u * t * t * s.x2 + t * t * t * s.x,
            u * u * u * py + 3 * u * u * t * s.y1 + 3 * u * t * t * s.y2 + t * t * t * s.y
          ])
        }
        px = s.x; py = s.y
        break
      }
      case 'Q': {
        const n = Math.min(MAX_CORDES, Math.max(2, Math.ceil(Math.sqrt((0.25 * Math.hypot(px - 2 * s.x1 + s.x, py - 2 * s.y1 + s.y)) / FLATNESS))))
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t
          cur.push([u * u * px + 2 * u * t * s.x1 + t * t * s.x, u * u * py + 2 * u * t * s.y1 + t * t * s.y])
        }
        px = s.x; py = s.y
        break
      }
      case 'A': echantillonneArc(px, py, s, cur); px = s.x; py = s.y; break
      case 'Z':
        if (cur.length) { polys.push(cur); px = cur[0]![0]; py = cur[0]![1] }
        cur = []
        break
    }
  }
  if (cur.length) polys.push(cur)
  return polys.filter((p) => p.length >= 3)
}

/** Nombre d'enroulement d'un point contre tous les sous-chemins (regle nonzero du SVG). */
export function enroulement(polys: Point[][], x: number, y: number): number {
  let w = 0
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!
      const [xj, yj] = poly[j]!
      if (yj <= y) {
        if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) w++
      } else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) w--
    }
  }
  return w
}

export interface Bornes { minX: number; minY: number; maxX: number; maxY: number }

export function bornes(polys: Point[][]): Bornes {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const p of polys)
    for (const [x, y] of p) {
      if (x < b.minX) b.minX = x
      if (y < b.minY) b.minY = y
      if (x > b.maxX) b.maxX = x
      if (y > b.maxY) b.maxY = y
    }
  return b
}

/** Drapeaux nonzero d'une ligne entiere de points (xs croissants), en une passe sur les aretes. */
function ligneInterieure(polys: Point[][], y: number, xs: number[], out: Uint8Array): void {
  const hits: Array<[number, number]> = []
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xj, yj] = poly[j]!
      const [xi, yi] = poly[i]!
      if (yj <= y && yi > y) hits.push([xj + ((y - yj) * (xi - xj)) / (yi - yj), 1])
      else if (yi <= y && yj > y) hits.push([xj + ((y - yj) * (xi - xj)) / (yi - yj), -1])
    }
  }
  hits.sort((a, b) => a[0] - b[0])
  let w = 0, h = 0
  for (let k = 0; k < xs.length; k++) {
    while (h < hits.length && hits[h]![0] < xs[k]!) w += hits[h++]![1]
    out[k] = w !== 0 ? 1 : 0
  }
}

/** Aire pleine estimee sur une grille d'unites (regle nonzero). */
export function airePleine(polys: Point[][], b: Bornes = bornes(polys)): number {
  let n = 0
  const xs: number[] = []
  for (let x = Math.floor(b.minX) + 0.5; x < b.maxX; x += 1) xs.push(x)
  const ligne = new Uint8Array(xs.length)
  for (let y = Math.floor(b.minY) + 0.5; y < b.maxY; y += 1) {
    ligneInterieure(polys, y, xs, ligne)
    for (const v of ligne) n += v
  }
  return n
}
