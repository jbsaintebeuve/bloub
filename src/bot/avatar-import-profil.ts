/**
 * Conversion d'une silhouette (polygones aplatis) en profil radial de Bloub,
 * avec les refus qui vont avec : formes non radiales ou trop approximatives.
 *
 * Bloub ne represente un corps que par 64 rayons r(theta) — un echantillon
 * par pas de `PROFILE_SAMPLES`, theta nul pointant a droite et croissant dans
 * le sens horaire (y vers le bas) : le MEME axe que les coordonnees SVG du
 * parseur. La forme n'est representable que si, depuis le centre du visage,
 * chaque rayon traverse le remplissage en [0, r] sans interruption : aucune
 * anse, aucun trou, aucun appendice detache.
 *
 * La verification est EXACTE, pas echantillonnee : pour chaque rayon on
 * collecte toutes les intersections rayon/arete et on rederoule le nombre
 * d'enroulement (regle nonzero) en marchant vers l'infini. C'est le meme
 * geste que `profileFromPolygon` (`shape.ts`), suivi du diagnostic que lui
 * ne donne pas : ce qui est refuse l'est avec l'angle du premier rayon
 * fautif, pour le prompt de reparation.
 */

import { PROFILE_SAMPLES } from './profiles.ts'
import { enroulement, type Point } from './avatar-import-chemin.ts'

/** Chaque rayon de Bloub est raffine en autant de sondes intermediaires. */
export const RAFFINEMENT = 8
/** Nombre total de sondes angulaires. Borne de ressources de la verification. */
export const SONDES = PROFILE_SAMPLES * RAFFINEMENT

/** Sous cette distance, une intersection compte comme traversant le centre. */
const CENTRE_EPS = 1e-6
/** Arete quasi parallele au rayon : ignoree, ses voisines portent la traverse. */
const PARALLELE_EPS = 1e-12

export interface IntersectionRayon {
  /** Distance le long du rayon, en unites viewBox. */
  t: number
  /** Variation du nombre d'enroulement en franchissant l'arete vers l'exterieur. */
  delta: 1 | -1
}

/**
 * Toutes les intersections d'une demi-droite avec les aretes, triees par
 * distance croissante. `dx, dy` : direction UNITAIRE.
 *
 * L'appartenance d'une arete se juge sur la distance SIGNEE de ses extremites
 * a la ligne du rayon, regle mi-ouverte « va < 0 <= vb » : un sommet qui
 * tombe EXACTEMENT sur le rayon calcule le meme zero pour les deux aretes
 * qui le partagent, donc il n'est porte qu'une fois — et un sommet de
 * tangence (les deux aretes du meme cote) n'est pas porte du tout. Le test
 * naif sur la position u le long de l'arete laissait l'epsilon d'arrondi
 * faire compter les deux, ce qui faussait l'enroulement exactement quand une
 * grille de sondes alignait un rayon sur un sommet.
 */
export function intersections(polys: Point[][], cx: number, cy: number, dx: number, dy: number): IntersectionRayon[] {
  const hits: IntersectionRayon[] = []
  for (const poly of polys) {
    const n = poly.length
    for (let i = 0; i < n; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      const va = dx * (a[1] - cy) - dy * (a[0] - cx)
      const vb = dx * (b[1] - cy) - dy * (b[0] - cx)
      if (!((va < 0 && vb >= 0) || (va >= 0 && vb < 0))) continue
      const ex = b[0] - a[0]
      const ey = b[1] - a[1]
      const den = dx * ey - dy * ex
      if (Math.abs(den) < PARALLELE_EPS) continue // arete parallele : ses voisines portent la traverse
      const ax = a[0] - cx
      const ay = a[1] - cy
      const t = (ax * ey - ay * ex) / den
      if (t <= 0) continue
      // en franchissant l'arete vers l'exterieur, l'enroulement varie du signe
      // de cross(arete, rayon) : l'arete quitte le champ « a droite du point »
      // du test d'enroulement. L'invariant `w0 + somme(delta) = 0` par rayon
      // est verifie par le test dedie.
      const croix = ex * dy - ey * dx
      hits.push({ t, delta: croix > 0 ? 1 : -1 })
    }
  }
  hits.sort((p, q) => p.t - q.t)
  return hits
}

/**
 * Marche un rayon : enroule les intersections depuis `w0` et rend la distance
 * de sortie — ou null si le remplissage le long du rayon n'est pas [0, r]
 * sans interruption (matiere qui reaparait apres la sortie, residu
 * d'enroulement au tres loin, contour qui passe par le centre).
 */
function sortieDuRayon(polys: Point[][], w0: number, cx: number, cy: number, dx: number, dy: number): number | null {
  const hits = intersections(polys, cx, cy, dx, dy)
  let w = w0
  let sortie: number | null = null
  for (const h of hits) {
    // le contour passe par le centre : le visage n'est pas pose sur du plein
    if (h.t < CENTRE_EPS) return null
    w += h.delta
    if (sortie === null) {
      if (w === 0) sortie = h.t
    } else if (w !== 0) {
      // reaparition de la matiere apres la sortie : anse, partie detachee,
      // concavite que le profil radial ne peut pas porter
      return null
    }
  }
  // au tres loin l'enroulement est nul partout : un residu non nul ici ne
  // devrait jamais arriver (invariant du dessus), mais il declasserait la
  // forme plutot que de fabriquer un rayon faux.
  return w === 0 ? sortie : null
}

export interface Sondage {
  /** Rayons aux angles de Bloub (indices multiples de RAFFINEMENT), en unites viewBox. */
  radii: number[]
  /** Vrai si chaque rayon traverse le remplissage en [0, r] sans interruption. */
  radial: boolean
  /**
   * Pire ecart relatif entre le profil echantillonne a 64 rayons et la vraie
   * silhouette sondee a SONDES angles : ce que la representation LINEAIRE de
   * Bloub fait perdre au pire, en fraction du rayon moyen.
   */
  approximation: number
  /** rMin / rMax sur les sondes fines. */
  aplatissement: number
  /** Angle horaire du premier rayon fautif, en degres, quand `radial` est faux. */
  angleFautif: number
}

/**
 * Sondage complet de la silhouette, en lecture seule, aucune exception. Un
 * centre hors du remplissage (le cas anneau, par exemple) rend `radial` faux.
 *
 * Les metriques de qualite ne sont calculees QUE si la forme est radiale :
 * une silhouette refusee laisse des rayons sans sortie, et zero dans les
 * moyennes y fabriquerait des diagnostics fantomes.
 */
export function sonde(polys: Point[][], cx: number, cy: number): Sondage {
  const w0 = enroulement(polys, cx, cy)
  const fines = new Array<number>(SONDES).fill(0)
  let radial = w0 !== 0
  let angleFautif = 0

  for (let s = 0; s < SONDES; s++) {
    const theta = (s / SONDES) * Math.PI * 2
    const sortie = sortieDuRayon(polys, w0, cx, cy, Math.cos(theta), Math.sin(theta))
    fines[s] = sortie ?? 0
    if (sortie === null && radial) {
      radial = false
      angleFautif = (theta * 180) / Math.PI
    }
  }
  if (!radial) {
    return { radii: [], radial: false, approximation: 0, aplatissement: 0, angleFautif }
  }

  const radii: number[] = []
  for (let k = 0; k < PROFILE_SAMPLES; k++) radii.push(fines[k * RAFFINEMENT] ?? 0)

  // pire ecart entre l'interpolation lineaire des 64 rayons retenus (ce que
  // `radiusAtAngle` rend) et la vraie silhouette : c'est la qu'une dent trop
  // fine, invisible entre deux echantillons, se fait prendre
  let approximation = 0
  let somme = 0
  for (let s = 0; s < SONDES; s++) somme += fines[s] ?? 0
  const moyenne = somme / SONDES
  if (moyenne > 0) {
    for (let k = 0; k < PROFILE_SAMPLES; k++) {
      const r0 = fines[k * RAFFINEMENT] ?? 0
      const r1 = fines[((k + 1) % PROFILE_SAMPLES) * RAFFINEMENT] ?? 0
      for (let m = 1; m < RAFFINEMENT; m++) {
        const attendu = r0 + ((r1 - r0) * m) / RAFFINEMENT
        const ecart = Math.abs((fines[k * RAFFINEMENT + m] ?? 0) - attendu)
        if (ecart > approximation) approximation = ecart
      }
    }
    approximation /= moyenne
  }

  let rMin = Infinity
  let rMax = 0
  for (const r of fines) {
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
  }

  return { radii, radial, approximation, aplatissement: rMax > 0 ? rMin / rMax : 0, angleFautif }
}

/**
 * Normalise les rayons vers la convention des formes persistees du
 * personnalisateur : pic a 1,08 — celle des profils de la galerie
 * (`profils-galerie.ts`), pour qu'une forme importee pese pareil a l'oeil.
 */
export function normalise(radii: number[]): number[] {
  const pic = Math.max(...radii)
  if (!(pic > 0)) return []
  const k = 1.08 / pic
  return radii.map((r) => Math.round(r * k * 10000) / 10000)
}
