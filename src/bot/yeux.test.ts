import { describe, expect, it } from 'vitest'
import { capsulePath } from './shape'
import { ARC_HEUREUX, centreArc, cheminContour, cheminOeil, contourOeil } from './yeux'

/** Une taille d'œil en unités de viewBox (rayon de boule 100). */
const W = 26
const H = 46

describe('cheminOeil', () => {
  it("rend la gélule exacte quand il n'y a pas d'arc", () => {
    expect(cheminOeil(W, H, 0)).toBe(capsulePath(W, H))
    expect(cheminOeil(W, H)).toBe(capsulePath(W, H))
    expect(cheminOeil(W, H, -1)).toBe(capsulePath(W, H))
  })

  it("rend un chemin fermé lisse pour l'arc, stable au byte près", () => {
    const d = cheminOeil(W, H, 1)
    expect(d).toBe(cheminOeil(W, H, 1))
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('Q')
    expect(d.match(/M/g)).toHaveLength(1)
    expect(d).toBe(cheminContour(contourOeil(W, H, 1)))
  })

  it("borne l'arc comme OBA : largeur en w, hauteur en h, trait de stroke·w", () => {
    const c = contourOeil(W, H, 1)
    const xs = c.map((p) => p.x)
    const ys = c.map((p) => p.y)
    const r = (W * ARC_HEUREUX.stroke) / 2
    const hw = W * ARC_HEUREUX.halfWidth
    // tout point du contour est à distance r de la ligne médiane, dont |x| <= hw
    expect(Math.max(...xs)).toBeLessThanOrEqual(hw + r + 1e-9)
    expect(Math.max(...xs)).toBeGreaterThan(hw + r - 0.5)
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 6)
    // en haut, le sommet de la courbe (s = 0.5) moins le rayon du trait ;
    // `peak` est le point de CONTROLE de la quadratique, pas un point de la courbe
    const sommet = 0.5 * H * ARC_HEUREUX.base - 0.5 * H * ARC_HEUREUX.peak
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(sommet - r - 1e-9)
    expect(Math.min(...ys)).toBeLessThan(sommet - r + 0.5)
    // en bas, le bout rond descend jusqu'à base·h + r (à l'échantillonnage près)
    expect(Math.max(...ys)).toBeLessThanOrEqual(H * ARC_HEUREUX.base + r + 1e-9)
    expect(Math.max(...ys)).toBeGreaterThan(H * ARC_HEUREUX.base + r - 1.5)
  })

  it("mélange point par point : chaque point du contour intermédiaire est entre les deux", () => {
    const pilule = contourOeil(W, H, 0)
    const arc = contourOeil(W, H, 1)
    expect(pilule).toHaveLength(arc.length)
    for (const a of [0.25, 0.5, 0.75]) {
      const mix = contourOeil(W, H, a)
      expect(mix).toHaveLength(pilule.length)
      for (let i = 0; i < mix.length; i++) {
        const loX = Math.min(pilule[i]!.x, arc[i]!.x)
        const hiX = Math.max(pilule[i]!.x, arc[i]!.x)
        const loY = Math.min(pilule[i]!.y, arc[i]!.y)
        const hiY = Math.max(pilule[i]!.y, arc[i]!.y)
        expect(mix[i]!.x).toBeGreaterThanOrEqual(loX - 1e-9)
        expect(mix[i]!.x).toBeLessThanOrEqual(hiX + 1e-9)
        expect(mix[i]!.y).toBeGreaterThanOrEqual(loY - 1e-9)
        expect(mix[i]!.y).toBeLessThanOrEqual(hiY + 1e-9)
      }
    }
  })

  it("s'éloigne de la gélule linéairement en arc : interpolation lisible", () => {
    const pilule = contourOeil(W, H, 0)
    const dist = (a: number) =>
      contourOeil(W, H, a).reduce(
        (s, p, i) => s + Math.hypot(p.x - pilule[i]!.x, p.y - pilule[i]!.y),
        0
      )
    const d1 = dist(1)
    expect(dist(0)).toBeCloseTo(0, 6)
    expect(d1).toBeGreaterThan(0)
    for (const a of [0.25, 0.5, 0.75]) expect(dist(a)).toBeCloseTo(d1 * a, 6)
  })
})

describe('centreArc', () => {
  it("décrit la quadratique médiane de l'arc, bouts compris", () => {
    const c = centreArc(W, H)
    expect(c[0]!.x).toBeCloseTo(-W * ARC_HEUREUX.halfWidth, 6)
    expect(c[0]!.y).toBeCloseTo(H * ARC_HEUREUX.base, 6)
    expect(c[c.length - 1]!.x).toBeCloseTo(W * ARC_HEUREUX.halfWidth, 6)
    expect(c[c.length - 1]!.y).toBeCloseTo(H * ARC_HEUREUX.base, 6)
    // au milieu (s = 0.5), la quadratique vaut la moitié des bouts plus la moitié du contrôle
    const mid = c[Math.floor(c.length / 2)]!
    expect(mid.x).toBeCloseTo(0, 6)
    expect(mid.y).toBeCloseTo(0.5 * H * ARC_HEUREUX.base - 0.5 * H * ARC_HEUREUX.peak, 6)
  })
})

describe('cheminContour', () => {
  it('échantillonne un contour fermé en une quadratique par point, joints aux milieux', () => {
    const pts = contourOeil(W, H, 0.5)
    const d = cheminContour(pts)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect((d.match(/Q/g) ?? []).length).toBe(pts.length)
    // déterministe : même contour, même chaîne
    expect(cheminContour(pts)).toBe(d)
  })
})
