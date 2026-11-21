import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { decalageDesYeux } from './eyefit'
import { EXPRESSION_BY_ID } from './expressions'
import { radiusAtAngle } from './shape'
import { SHAPE_BY_ID } from './skins'
import { contourOeil } from './yeux'

/**
 * Le cache d'eyefit est PARESSEUX et PAR REFERENCE : une forme du catalogue est
 * résolue à sa première lecture, et un profil importé — n'importe quel tableau
 * de rayons passé tel quel au moteur — l'est aussi, sans que personne ait à
 * l'enregistrer nulle part. C'est ce qui rend la correction accessible aux
 * profils importés.
 */
describe('cache paresseux par reference', () => {
  it("résout un profil inconnu (type importé) à sa première lecture, puis le mémoise", () => {
    // nouvelle référence, hors catalogue
    const importe = SHAPE_BY_ID.get('goutte')!.radii.map((r) => r * 0.97)
    const a = decalageDesYeux(importe, 'idle', 'ravi')
    expect(Number.isFinite(a.x + a.y)).toBe(true)
    // même référence -> le même objet, résolu une seule fois
    expect(decalageDesYeux(importe, 'idle', 'ravi')).toBe(a)
    // référence distincte, même contenu : résolue à part, même valeur
    const copie = importe.slice()
    const b = decalageDesYeux(copie, 'idle', 'ravi')
    expect(b).not.toBe(a)
    expect(b).toEqual(a)
  })

  it("a une entrée `ravi` par état à visage de repos, et elle diffère de la gélule", () => {
    const cercle = SHAPE_BY_ID.get('cercle')!.radii
    // sur le cercle la correction est nulle, mais l'entrée existe
    expect(decalageDesYeux(cercle, 'idle', 'ravi')).toEqual({ x: 0, y: 0 })
    // l'arc étant plus large que la gélule, sa correction propre diffère
    const capsule = SHAPE_BY_ID.get('capsule')!.radii
    const ravi = decalageDesYeux(capsule, 'idle', 'ravi')
    const neutre = decalageDesYeux(capsule, 'idle', 'neutre')
    expect(Math.hypot(ravi.x - neutre.x, ravi.y - neutre.y)).toBeGreaterThan(0.001)
  })

  it('vaut zéro pour null ou un profil illisible, sans rien mettre en cache', () => {
    expect(decalageDesYeux(null, 'idle', 'ravi')).toEqual({ x: 0, y: 0 })
    expect(decalageDesYeux([1, Number.NaN, 3], 'idle', null)).toEqual({ x: 0, y: 0 })
  })

  it("garde l'arc dans la silhouette sur un profil importé, derive comprise", () => {
    const importe = SHAPE_BY_ID.get('capsule')!.radii.map((r) => r * 0.95)
    const ravi = EXPRESSION_BY_ID.get('ravi')!
    const e = new BotEngine(100, 'idle', importe, ravi)
    for (let i = 0; i < 40; i++) {
      const f = e.sample(i * 0.05)
      for (let k = 0; k < f.eyes.length; k++) {
        const m = /matrix\(([^)]+)\)/.exec(f.eyes[k]!.matrix)![1]!.split(',').map(Number) as number[]
        const cfg = ravi.eyes[k]!
        for (const p of contourOeil(cfg.w * 100, cfg.h * 100, 1)) {
          const x = m[0]! * p.x + m[2]! * p.y + m[4]!
          const y = m[1]! * p.x + m[3]! * p.y + m[5]!
          const bord = radiusAtAngle(importe, Math.atan2(y, x)) * 100
          expect(Math.hypot(x, y), `t=${(i * 0.05).toFixed(2)} oeil ${k}`).toBeLessThan(bord * 1.01)
        }
      }
    }
  })

  it('ne change pas la pureté du moteur : relire une date redonne la même image', () => {
    const importe = SHAPE_BY_ID.get('triangle')!.radii.map((r) => r * 0.98)
    const e = new BotEngine(100, 'idle', importe, EXPRESSION_BY_ID.get('ravi')!)
    const a = e.sample(1.2)
    e.sample(5)
    const b = e.sample(1.2)
    expect(b.bodyPath).toBe(a.bodyPath)
    expect(b.eyes.map((y) => y.d + y.matrix)).toEqual(a.eyes.map((y) => y.d + y.matrix))
  })
})
