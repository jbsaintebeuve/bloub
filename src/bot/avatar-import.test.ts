import { describe, expect, it } from 'vitest'
import {
  importerAvatar,
  MAX_STOCKAGE,
  MAX_STOCKEES,
  MAX_TEXTE,
  parseStoredAvatars,
  SEUIL_APPROX,
  SEUIL_PLAT,
  type Diagnostic,
  type ImportedAvatar
} from './avatar-import'
import { aplatir, enroulement, parseChemin } from './avatar-import-chemin'
import { intersections, normalise, sonde } from './avatar-import-profil'
import { PROFILE_SAMPLES } from './profiles'

/**
 * L'import d'avatar, verifie sur les VRAIS exemples du contrat : les fichiers
 * de la galerie open-bot-avatar sont collees ici tels quels, comme le ferait
 * un utilisateur qui visite la galerie. Ce sont eux qui definissent l'esprit
 * du format ; les refus attendus (anse, pieces detachedes, pointes fines)
 * sont tout aussi reels.
 */

const codes = (r: { diagnostics: Diagnostic[] }) => r.diagnostics.map((d) => d.code)

// galerie open-bot-avatar (MIT), collees telles quelles
const ETOILE = `{"version":1,"id":"star","name":"Star","body":{"path":"M53.7 17.95L62 31.2Q64.1 34.6 68 35.6L83.1 39.3Q89.9 41 85.4 46.4L75.4 58.3Q72.8 61.4 73.1 65.4L74.2 81Q74.7 88 68.2 85.4L53.7 79.5Q50 78 46.3 79.5L31.8 85.4Q25.3 88 25.8 81L26.9 65.4Q27.2 61.4 24.6 58.3L14.6 46.4Q10.1 41 16.9 39.3L32 35.6Q35.9 34.6 38 31.2L46.3 17.95Q50 12 53.7 17.95Z"},"eyes":{"x":50,"y":52,"spacing":16,"scale":1.1}}`

const FANTOME = `{"version":1,"id":"ghost","name":"Ghost","body":{"path":"M24 50C24 28 35 12 50 12C65 12 76 28 76 50L77 80C77 85 73 88 68 88C63 88 61 84 59 81C57 84 54 88 50 88C46 88 43 84 41 81C39 84 37 88 32 88C27 88 23 85 23 80Z"},"eyes":{"x":50,"y":42,"spacing":16,"scale":1.15}}`

const NUAGE = `{"version":1,"id":"cloud","name":"Cloud","body":{"path":"M24 76C14 76 9 69 9 61C9 52 15 46 23 45.5C25 33 36 24 49 24C61 24 70 31 73 41C83 41 91 49 91 59C91 69 83 76 74 76Z"},"eyes":{"x":50,"y":54,"spacing":17,"scale":1.15}}`

// examples embarques du contrat (packages/core/src/examples.ts, MIT)
const BARBELL = `{"version":1,"id":"barbell","name":"Barbell","body":{"path":"M12 41H12A4 4 0 0 1 16 45V55A4 4 0 0 1 12 59H12A4 4 0 0 1 8 55V45A4 4 0 0 1 12 41ZM18 29H18A4 4 0 0 1 22 33V67A4 4 0 0 1 18 71H18A4 4 0 0 1 14 67V33A4 4 0 0 1 18 29ZM26 17H26A5 5 0 0 1 31 22V78A5 5 0 0 1 26 83H26A5 5 0 0 1 21 78V22A5 5 0 0 1 26 17ZM38 33H62A10 10 0 0 1 72 43V57A10 10 0 0 1 62 67H38A10 10 0 0 1 28 57V43A10 10 0 0 1 38 33ZM74 17H74A5 5 0 0 1 79 22V78A5 5 0 0 1 74 83H74A5 5 0 0 1 69 78V22A5 5 0 0 1 74 17ZM82 29H82A4 4 0 0 1 86 33V67A4 4 0 0 1 82 71H82A4 4 0 0 1 78 67V33A4 4 0 0 1 82 29ZM88 41H88A4 4 0 0 1 92 45V55A4 4 0 0 1 88 59H88A4 4 0 0 1 84 55V45A4 4 0 0 1 88 41Z"},"eyes":{"x":50,"y":50,"spacing":15,"scale":1.05}}`

const MUG = `{"version":1,"id":"mug","name":"Mug","body":{"path":"M22 20H62C67 20 70 23 70 28V72C70 80 64 86 56 86H28C20 86 14 80 14 72V28C14 23 17 20 22 20ZM68 36C80 34 87 42 87 53C87 64 80 72 68 70ZM69 45L69 61C75.5 62 79 58.5 79 53C79 47.5 76 44 69 45Z"},"eyes":{"x":42,"y":49,"spacing":16,"scale":1.15}}`

const CHAT = `{"version":1,"id":"cat","name":"Cat","body":{"path":"M50 23C68 23 82 30 82 45C82 58 68 65 50 65C32 65 18 58 18 45C18 30 32 23 50 23ZM24 42C21 32 20 22 22 15C23 11 26 10 29 12C34 16 39 21 44 28L36 42ZM64 42L56 28C61 21 66 16 71 12C74 10 77 11 78 15C80 22 79 32 76 42ZM38 56L62 56C70 56 74 66 74 76C74 83 70 86 63 86L37 86C30 86 26 83 26 76C26 66 30 56 38 56ZM70 72C77 74 81 70 80 64C79 60 81 57 84 58C87 59 88.5 63 88 68C87 77 80 83 70 81Z"},"eyes":{"x":50,"y":43,"spacing":17,"scale":1.1}}`

/** Fusee de la galerie : pointe fine, ailettes — trop detaillee pour 64 rayons. */
const FUSEE = `{"version":1,"id":"rocket","name":"Rocket","body":{"path":"M46 10C48 8.5 52 8.5 54 10C64 17 71 29 71 44V72H29V44C29 29 36 17 46 10ZM29 56H71C80 61 86 70 86 80C86 84 83 86 79 85L72 83H28L21 85C17 86 14 84 14 80C14 70 20 61 29 56ZM42 80H58C59 86 55 90 50 92C45 90 41 86 42 80Z"},"eyes":{"x":50,"y":46,"spacing":15,"scale":1.05}}`

/** Un stade tres etire : passable pour le contrat v1, trop plat pour Bloub. */
const STADE = `{"version":1,"id":"stade","name":"Stade","body":{"path":"M26 38H74A12 12 0 0 1 74 62H26A12 12 0 0 1 26 38Z"},"eyes":{"x":50,"y":50,"spacing":15,"scale":1}}`

/** Un cercle : la base de toutes les mesures d'orientation. */
const CERCLE = `{"version":1,"id":"ronde","name":"Ronde","body":{"path":"M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10Z"},"eyes":{"x":50,"y":50,"spacing":15,"scale":1}}`

/** Oeuf vertical de la galerie, pour verifier la convention d'axe. */
const OEUF = `{"version":1,"id":"egg","name":"Egg","body":{"path":"M50 8C63 8 74 24 74 45C74 68 63 86 50 86C37 86 26 68 26 45C26 24 37 8 50 8Z"},"eyes":{"x":50,"y":46,"spacing":15,"scale":1}}`

/** Un anneau : le centre des yeux tombe dans le trou — non radial par construction. */
const ANNEAU = `{"version":1,"id":"ring","name":"Ring","body":{"path":"M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10ZM50 46A4 4 0 1 0 50 54A4 4 0 1 0 50 46Z"},"eyes":{"x":50,"y":50,"spacing":15,"scale":0.6}}`

describe('accepte la galerie conforme', () => {
  it('etoile, fantome, nuage et oeuf donnent 64 rayons positifs', () => {
    for (const json of [ETOILE, FANTOME, NUAGE, OEUF]) {
      const r = importerAvatar(json)
      expect(codes(r), JSON.parse(json).id).toEqual([])
      const avatar = r.avatar!
      expect(avatar.radii).toHaveLength(PROFILE_SAMPLES)
      for (const r2 of avatar.radii) expect(r2).toBeGreaterThan(0)
      expect(Math.max(...avatar.radii)).toBeCloseTo(1.08, 3)
    }
  })

  it('un cercle reste un cercle : tous les rayons egaux', () => {
    const { avatar } = importerAvatar(CERCLE)
    const pic = Math.max(...avatar!.radii)
    for (const r of avatar!.radii) expect(r).toBeCloseTo(pic, 2)
  })

  it('conserve l’orientation : index 0 a droite, 16 en bas, 48 en haut (y vers le bas)', () => {
    // l'oeuf est plus haut que large : les rayons vers le haut (48) et le bas
    // (16) depassent celui vers la droite (0)
    const { avatar } = importerAvatar(OEUF)
    expect(avatar!.radii[48]).toBeGreaterThan(avatar!.radii[0]!)
    expect(avatar!.radii[16]).toBeGreaterThan(avatar!.radii[0]!)
  })

  it('demèle le JSON enrobé d’une cloture de code', () => {
    const colle = 'Voici votre avatar :\n```json\n' + ETOILE + '\n```\nBonne journée !'
    expect(codes(importerAvatar(colle))).toEqual([])
  })

  it('normalise : pic a 1.08, quatre decimales', () => {
    expect(normalise([1, 2, 3])).toEqual([0.36, 0.72, 1.08])
    expect(normalise([])).toEqual([])
  })
})

describe('refuse les formes non radiales ou trop approximatives', () => {
  it('le mug : l’anse traverse deux fois le meme rayon', () => {
    expect(codes(importerAvatar(MUG))).toEqual(['bloub.radial'])
  })

  it('le barbell : les plaques reaparaissent apres la barre', () => {
    expect(codes(importerAvatar(BARBELL))).toEqual(['bloub.radial'])
  })

  it('le chat : oreilles et queue detachees', () => {
    expect(codes(importerAvatar(CHAT))).toEqual(['bloub.radial'])
  })

  it('l’anneau : le centre des yeux est dans le trou', () => {
    expect(codes(importerAvatar(ANNEAU))).toEqual(['bloub.radial'])
  })

  it('la fusee : pointe trop fine pour 64 rayons (approximatif + plat)', () => {
    const r = importerAvatar(FUSEE)
    expect(r.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['bloub.approximatif', 'bloub.plat'])
    )
  })

  it('le stade : radial mais trop plat, et rien d’autre a lui reprocher', () => {
    expect(codes(importerAvatar(STADE))).toEqual(['bloub.plat'])
  })

  it('le seuil d’aplatissement arrete le stade (33 %) et laisse passer le fantome (50 %)', () => {
    // le seuil se tient ENTRE les deux formes mesurees : c’est le test qui
    // fige ce placement, pour qu’un reglage futur ne reveille pas le stade
    // ni ne perde le fantome
    expect(SEUIL_PLAT).toBeGreaterThan(12 / 36)
    expect(SEUIL_PLAT).toBeLessThan(0.498)
  })

  it('le seuil d’approximation arrete la fusee (11,1 %) et laisse passer le fantome (7,7 %)', () => {
    expect(SEUIL_APPROX).toBeGreaterThan(0.077)
    expect(SEUIL_APPROX).toBeLessThan(0.11)
  })
})

describe('invariant du compte des rayons', () => {
  it('w0 + somme des deltas = 0 sur chaque rayon (etoile et fantome)', () => {
    for (const json of [ETOILE, FANTOME]) {
      const def = JSON.parse(json) as { body: { path: string }; eyes: { x: number; y: number } }
      const polys = aplatir(parseChemin(def.body.path))
      const w0 = enroulement(polys, def.eyes.x, def.eyes.y)
      expect(w0).not.toBe(0)
      for (let s = 0; s < 64; s++) {
        const theta = (s / 64) * Math.PI * 2
        const hits = intersections(polys, def.eyes.x, def.eyes.y, Math.cos(theta), Math.sin(theta))
        expect(w0 + hits.reduce((somme, h) => somme + h.delta, 0)).toBe(0)
      }
    }
  })

  it('chaque rayon garde ses intersections dans l’ordre croissant', () => {
    const def = JSON.parse(ETOILE) as { body: { path: string }; eyes: { x: number; y: number } }
    const polys = aplatir(parseChemin(def.body.path))
    const hits = intersections(polys, def.eyes.x, def.eyes.y, 0.123, -0.992)
    expect(hits.map((h) => h.t)).toEqual([...hits.map((h) => h.t)].sort((a, b) => a - b))
  })
})

describe('refus du contrat v1', () => {
  const base = JSON.parse(ETOILE)
  // `any` assume : la retouche MUTATE volontairement des champs de types
  // inattendus — c'est ce qu'on teste, et le typer fausserait le geste.
  const leve = (retouche: (d: any) => void) => {
    const clone = JSON.parse(JSON.stringify(base))
    retouche(clone)
    return JSON.stringify(clone)
  }

  it('texte vide : aucun diagnostic, aucun avatar', () => {
    const r = importerAvatar('   ')
    expect(r.avatar).toBeNull()
    expect(r.diagnostics).toEqual([])
  })

  it('trop long', () => {
    const r = importerAvatar('x'.repeat(MAX_TEXTE + 1))
    expect(codes(r)).toEqual(['json.tropLong'])
  })

  it('pas du JSON', () => {
    expect(codes(importerAvatar('un joli rond mais pas JSON'))).toContain('json.invalide')
  })

  it('racine non objet', () => {
    expect(codes(importerAvatar('[1, 2, 3]'))).toEqual(['racine'])
  })

  it('champ inconnu', () => {
    expect(codes(importerAvatar(leve((d) => { d.color = '#f00' })))).toContain('champ')
  })

  it('version', () => {
    expect(codes(importerAvatar(leve((d) => { d.version = 2 })))).toContain('version')
  })

  it('id et nom', () => {
    expect(codes(importerAvatar(leve((d) => { d.id = 'Mauvais!' })))).toContain('id')
    expect(codes(importerAvatar(leve((d) => { d.name = '' })))).toContain('nom')
    expect(codes(importerAvatar(leve((d) => { d.name = 'a<b' })))).toContain('nom')
  })

  it('corps et eyes mal formes', () => {
    expect(codes(importerAvatar(leve((d) => { d.body = 3 })))).toContain('corps')
    expect(codes(importerAvatar(leve((d) => { delete d.eyes })))).toContain('yeux')
    expect(codes(importerAvatar(leve((d) => { d.eyes = { x: 'a', y: 1, spacing: 15, scale: 1 } })))).toContain('yeux.nombres')
    expect(codes(importerAvatar(leve((d) => { d.eyes.scale = 5 })))).toContain('yeux.echelle')
    expect(codes(importerAvatar(leve((d) => { d.eyes.spacing = 3 })))).toContain('yeux.espacement')
  })

  it('chemin : caractere interdit, coordonnee hors viewBox', () => {
    expect(codes(importerAvatar(leve((d) => { d.body.path = 'M10 10 <script>' })))).toContain('chemin')
    expect(codes(importerAvatar(leve((d) => { d.body.path = 'M-40 10L200 10L200 60L-40 60Z' })))).toContain('chemin')
  })

  it('sortie de zone sure', () => {
    expect(
      codes(importerAvatar(leve((d) => { d.body.path = 'M4 4H96V96H4Z'; d.eyes = { x: 50, y: 50, spacing: 15, scale: 1 } })))
    ).toContain('bornes')
  })

  it('corps trop petit', () => {
    expect(
      codes(importerAvatar(leve((d) => { d.body.path = 'M42 42H58V58H42Z'; d.eyes = { x: 50, y: 50, spacing: 7, scale: 0.6 } })))
    ).toEqual(expect.arrayContaining(['minuscule', 'aire']))
  })

  it('yeux dehors', () => {
    expect(
      codes(importerAvatar(leve((d) => { d.eyes = { x: 50, y: 20, spacing: 15, scale: 1 } })))
    ).toContain('yeux.dehors')
  })
})

describe('rehydration grelite', () => {
  const unAvatar = (id: string): ImportedAvatar => ({
    id: `perso-${id}`,
    name: `Avatar ${id}`,
    radii: Array.from({ length: PROFILE_SAMPLES }, (_, i) => 0.8 + (i % 7) * 0.03)
  })

  it('reprend un aller-retour de stockage intact', () => {
    const avatars = [unAvatar('a'), unAvatar('b')]
    expect(parseStoredAvatars(JSON.stringify(avatars))).toEqual(avatars)
  })

  it('accepte l’avatar que l’import vient de produire', () => {
    const { avatar } = importerAvatar(ETOILE)
    const relus = parseStoredAvatars(JSON.stringify([avatar!]))
    expect(relus).toEqual([avatar])
  })

  it('rend une liste vide sur null, texte vide, JSON casse, racine non tableau', () => {
    expect(parseStoredAvatars(null)).toEqual([])
    expect(parseStoredAvatars('')).toEqual([])
    expect(parseStoredAvatars('pas json')).toEqual([])
    expect(parseStoredAvatars('{"id":"perso-x"}')).toEqual([])
  })

  it('saute les entrees deformees, garde les saines', () => {
    const saine = unAvatar('saine')
    const brute = JSON.stringify([
      42,
      null,
      { id: 'sans-prefixe', name: 'X', radii: saine.radii },
      { id: 'perso-ok', name: 7, radii: saine.radii },
      { id: 'perso-courts', name: 'Trop court', radii: [1, 2, 3] },
      { id: 'perso-negatif', name: 'Négatif', radii: saine.radii.map((r) => r - 1) },
      { id: 'perso-derive', name: 'Plafond', radii: saine.radii.map(() => 2.5) },
      { id: 'perso-nan', name: 'NaN', radii: saine.radii.map((r) => r * Number.NaN) },
      { id: 'perso-vide', name: '', radii: saine.radii },
      saine
    ])
    expect(parseStoredAvatars(brute)).toEqual([saine])
  })

  it('dedoublonne par id : le premier gagne', () => {
    const a = unAvatar('x')
    const b = { ...unAvatar('x'), name: 'Second' }
    expect(parseStoredAvatars(JSON.stringify([a, b]))).toEqual([a])
  })

  it('cappe a MAX_STOCKEES entrees', () => {
    const longue: ImportedAvatar[] = []
    for (let i = 0; i < MAX_STOCKEES + 15; i++) longue.push(unAvatar(`a${i}`))
    expect(parseStoredAvatars(JSON.stringify(longue))).toHaveLength(MAX_STOCKEES)
  })

  it('ignore un stockage trop long sans meme l’analyser', () => {
    expect(parseStoredAvatars('['.padEnd(MAX_STOCKAGE + 1, '['))).toEqual([])
  })

  it('jamais d’exception, meme sur des types inattendus', () => {
    expect(() => parseStoredAvatars('{"a":')).not.toThrow()
  })
})

describe('sonde : mesures brutes', () => {
  it('le stade est radial, mais son aplatissement est sous le seuil', () => {
    const def = JSON.parse(STADE) as { body: { path: string }; eyes: { x: number; y: number } }
    const s = sonde(aplatir(parseChemin(def.body.path)), def.eyes.x, def.eyes.y)
    expect(s.radial).toBe(true)
    expect(s.aplatissement).toBeLessThan(SEUIL_PLAT)
    expect(s.approximation).toBeLessThan(SEUIL_APPROX)
  })

  it('le mug n’est pas radial depuis ses yeux, et le sondage ne leve pas', () => {
    const def = JSON.parse(MUG) as { body: { path: string }; eyes: { x: number; y: number } }
    const s = sonde(aplatir(parseChemin(def.body.path)), def.eyes.x, def.eyes.y)
    expect(s.radial).toBe(false)
    expect(s.radii).toEqual([])
    expect(Number.isFinite(s.angleFautif)).toBe(true)
  })
})
