import { PROFILE_SAMPLES } from './profiles'
import {
  hullOfCircles,
  profileFromPolygon,
  regularPolygonProfile,
  roundedPolygonProfile,
  superellipseProfile,
  unionOfCirclesProfile
} from './shape'

/**
 * Formes et couleurs proposees par le personnalisateur du bot.
 *
 * A la difference des silhouettes d'animation (`profiles.ts`), celles-ci ne sont
 * PAS relevees sur la video : elles sont construites analytiquement d'apres la
 * grille du personnalisateur d'origine. Deux sources distinctes, donc, et c'est
 * volontaire — les etats animes doivent rester fideles a la video, les formes de
 * base sont un choix d'utilisateur.
 */

/**
 * Les identifiants sont enumeres plutot que deduits du tableau : c'est ce qui
 * permet a la couche i18n de verifier A LA COMPILATION que chaque forme a bien
 * sa traduction dans les trois langues (`t(\`shapes.${id}\`)` ne compile que si
 * la cle existe). Un `as const` sur le tableau aurait le meme effet mais
 * rendrait `radii` en lecture seule, alors que le moteur le passe tel quel.
 */
export type ShapeId =
  | 'cercle'
  | 'galet'
  | 'squircle'
  | 'capsule'
  | 'triangle'
  | 'hexagone'
  | 'nuage'
  | 'goutte'
  | 'etoile'
  | 'coeur'
  | 'losange'

export interface BotShape {
  id: ShapeId
  radii: number[]
}

/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
function normalize(radii: number[], max = 1): number[] {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
  1.02
)

/** Nuage : union de bosses, large en bas, deux lobes en haut. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.2, r: 0.54 },
    { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 },
    { x: -0.24, y: -0.3, r: 0.48 },
    { x: 0.3, y: -0.24, r: 0.44 }
  ]),
  1.02
)

/** Goutte : gros disque en bas, pointe effilee en haut. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.04
)

/** Capsule couchee : enveloppe de deux disques cote a cote. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0)

/** Nombre de branches de l'etoile, et rayons de ses aretes avant arrondi. */
const BRANCHES = 5

/**
 * Etoile : dix sommets alternes entre pointe et creux, adoucis comme les autres
 * formes du personnalisateur. Pointe en haut, et creux tenant les yeux vers les
 * deux branches basses — c'est la disposition qui laisse a la table d'`eyefit` le
 * moins de travai a faire pour recoller le visage au contour reel.
 */
const star = normalize(
  roundedPolygonProfile(
    Array.from({ length: 2 * BRANCHES }, (_, k) => {
      // -90deg + k croissant : sens horaire a l'ecran, la premiere pointe en haut
      const a = -Math.PI / 2 + (k / (2 * BRANCHES)) * Math.PI * 2
      const r = k % 2 === 0 ? 1.28 : 0.74
      return { x: Math.cos(a) * (r - 0.13), y: Math.sin(a) * (r - 0.13) }
    }),
    0.13
  ),
  1.08
)

/**
 * Coeur : la courbe parametrique classique, echantillonnee puis recentree.
 * Le centre de visee doit rester dans le NOYAU de la silhouette (la zone d'ou
 * l'on voit tout le contour, verifiee par mesure : une intersection par rayon) :
 * plus haut, le lancer de rayon traverse le creux inter-lobes et
 * `profileFromPolygon`, qui garde l'intersection la plus lointaine, remplit la
 * vallee. Un recentrage plus bas rapprocherait le creux de l'origine, sous le
 * plancher de rayon minimal que le reste du moteur suppose.
 */
const HEART_SAMPLES = 128
/*
 * -0.05 : le creux inter-lobes doit rester plus haut que le plancher de rayon
 * minimal (0,3) suppose par le reste du moteur, meme apres normalisation sur le
 * pic lateral. Plus bas, le creux se rapproche de l'origine et la forme retombe
 * sous la borne — c'est le seul role de cette constante.
 */
const HEART_CENTER = -0.05
/*
 * 1.2 : le coeur brut est juste assez etroit entre les deux lobes pour que le
 * regard de repos (en haut a droite) colle son oeil contre la paroi interieure
 * du lobe — d'ou des decalages d'expression tres disperces, et un rebroussement
 * hors borne pendant les morphs de visage.
 */
const HEART_WIDTH = 1.2

const heart = normalize(
  profileFromPolygon(
    Array.from({ length: HEART_SAMPLES }, (_, i) => {
      const t = (i / HEART_SAMPLES) * Math.PI * 2
      // 16 et 13 : les coefficients habituels de la courbe ; y ecran vers le bas,
      // donc le signe inverse pour garder la pointe en bas et les lobes en haut
      const x = ((16 * Math.sin(t) ** 3) / 16) * HEART_WIDTH
      const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16
      return { x, y: -y + HEART_CENTER }
    }),
    0,
    0
  ),
  1.06
)

/** Losange : carre tourne d'un quart de tour, sommets en haut et a droite. */
const losange = regularPolygonProfile(4, 1.14, 0.3, -90)

export const SHAPES: BotShape[] = [
  { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'galet', radii: pebble },
  // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
  // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
  { id: 'squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
  { id: 'capsule', radii: capsule },
  // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
  { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
  { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'nuage', radii: cloud },
  { id: 'goutte', radii: droplet },
  { id: 'etoile', radii: star },
  { id: 'coeur', radii: heart },
  { id: 'losange', radii: losange }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
export const SHAPE_BY_ID = new Map<string, BotShape>(SHAPES.map((s) => [s.id, s]))
export const DEFAULT_SHAPE = 'cercle'

export type ColorId =
  | 'encre'
  | 'creme'
  | 'brun'
  | 'rouge'
  | 'orange'
  | 'ambre'
  | 'vert'
  | 'turquoise'
  | 'bleu'
  | 'violet'
  | 'rose'
  | 'gris'
  | 'perso'

export interface BotColor {
  id: ColorId
  hex: string
}

/** Repli de la teinte libre : montre une couleur tant que rien n'est stocke. */
export const COULEUR_PERSO_DEFAUT = '#6366f1'

/** Palette du personnalisateur d'origine. */
export const COLORS: BotColor[] = [
  { id: 'encre', hex: '#0a0a0c' },
  { id: 'brun', hex: '#8b5e3c' },
  { id: 'rouge', hex: '#e8483f' },
  { id: 'orange', hex: '#f08a24' },
  { id: 'ambre', hex: '#f0b429' },
  { id: 'vert', hex: '#3ecf8e' },
  { id: 'turquoise', hex: '#2fbfa0' },
  { id: 'bleu', hex: '#3b93f0' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'rose', hex: '#e152b0' },
  { id: 'gris', hex: '#a3a3a3' },
  { id: 'creme', hex: '#f1efe9' },
  /*
   * Teinte libre : son `hex` n'est qu'un repli. La vraie valeur vit chez
   * l'appelant (localStorage puis prop `colorHex`), jamais ici — `src/bot/` ne
   * touche pas au stockage. Sans teinte passee, le rendu retombe sur le repli.
   */
  { id: 'perso', hex: COULEUR_PERSO_DEFAUT }
]

export const COLOR_BY_ID = new Map<string, BotColor>(COLORS.map((c) => [c.id, c]))
export const DEFAULT_COLOR = 'encre'

/**
 * Un `#RRGGBB` valable, et rien d'autre. Les navigateurs admettent des formes
 * plus larges dans un `<input type="color">`, mais le SVG exporte doit rester
 * portable : on borne ce qui franchit la frontiere stockage -> moteur, et toute
 * valeur relicotee invalide retombe sur l'encre.
 */
export function estHexValide(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
}

/** Melange deux couleurs hex. Sert a la brume de profondeur des particules. */
export function mixHex(from: string, to: string, t: number): string {
  const parse = (h: string) => {
    const v = parseInt(h.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = parse(from)
  const b = parse(to)
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * t))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
