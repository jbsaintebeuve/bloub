import { egg, ghost, shield, book, brain, camera, rocket, chat, controller, lightbulb } from './profils-galerie'
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
  | 'oeuf'
  | 'bouclier'
  | 'fantome'
  | 'livre'
  | 'cerveau'
  | 'appareil-photo'
  | 'fusee'
  | 'bulle'
  | 'manette'
  | 'ampoule'

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

/** Nombre de branches de l'etoile. */
const BRANCHES = 5

/*
 * 0.16 : arrondi des pointes et des creux. A 0.13, le retour `blase -> neutre`
 * faisait rebrousser les yeux de 15 unites, au-dela de la borne de 14 que pose
 * `skins.test.ts` ; a 0.16 le pire couple retombe a 12,9 sans toucher a la
 * profondeur des creux.
 */
const ETOILE_ARRONDI = 0.16

/**
 * Etoile : dix sommets alternes entre pointe et creux, adoucis comme les autres
 * formes du personnalisateur. Pointe en haut, et creux tenant les yeux vers les
 * deux branches basses — c'est la disposition qui laisse a la table d'`eyefit` le
 * moins de travail a faire pour recoller le visage au contour reel.
 */
const star = normalize(
  roundedPolygonProfile(
    Array.from({ length: 2 * BRANCHES }, (_, k) => {
      // -90deg + k croissant : sens horaire a l'ecran, la premiere pointe en haut
      const a = -Math.PI / 2 + (k / (2 * BRANCHES)) * Math.PI * 2
      const r = k % 2 === 0 ? 1.28 : 0.74
      return {
        x: Math.cos(a) * (r - ETOILE_ARRONDI),
        y: Math.sin(a) * (r - ETOILE_ARRONDI)
      }
    }),
    ETOILE_ARRONDI
  ),
  1.08
)

/**
 * Coeur dodu : deux lobes ronds, chacun relie a une pointe emoussee par
 * l'enveloppe convexe des deux disques, puis l'ensemble incline. Chaque
 * enveloppe est convexe et contient l'origine, donc leur union est etoilee
 * depuis le centre : un rayon ne croise le contour qu'une fois, et garder la
 * plus lointaine des deux intersections donne le contour exact, creux compris.
 * Le creux reste peu profond : c'est ce qui garde les yeux loin de la paroi
 * pendant les morphs d'expression.
 */
const LOBE_X = 0.36
const LOBE_Y = -0.16
const LOBE_R = 0.5
const POINTE_Y = 0.42
const POINTE_R = 0.34
/** Inclinaison, en degres : la pointe part vers la droite, comme le regard de repos. */
const COEUR_INCLINE = -22

function demiCoeur(cote: 1 | -1): number[] {
  const a = (COEUR_INCLINE * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  const pts = hullOfCircles(cote * LOBE_X, LOBE_Y, LOBE_R, 0, POINTE_Y, POINTE_R).map((p) => ({
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c
  }))
  return profileFromPolygon(pts, 0, 0)
}

const lobeGauche = demiCoeur(-1)
const lobeDroit = demiCoeur(1)
const heart = normalize(
  lobeGauche.map((r, i) => Math.max(r, lobeDroit[i] ?? 0)),
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
  { id: 'losange', radii: losange },
  { id: 'oeuf', radii: egg },
  { id: 'bouclier', radii: shield },
  { id: 'fantome', radii: ghost },
  { id: 'livre', radii: book },
  { id: 'cerveau', radii: brain },
  { id: 'appareil-photo', radii: camera },
  { id: 'fusee', radii: rocket },
  { id: 'bulle', radii: chat },
  { id: 'manette', radii: controller },
  { id: 'ampoule', radii: lightbulb }
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
 * valeur invalide retombe sur le repli de `perso`.
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

/**
 * Fond le plus sombre sur lequel le bot est pose : la vignette inactive de la
 * piste. Le papier du site (#f9f9f9) et le blanc des exports sont plus clairs,
 * donc une teinte qui tient contre celui-ci tient contre tous.
 */
const FOND_LE_PLUS_SOMBRE = '#f2f2f2'

/**
 * Contraste minimal corps / fond pour la teinte libre. Les yeux sont des TROUS
 * dans le corps : sous ce seuil, ce n'est pas seulement la silhouette qui
 * s'efface, c'est tout le visage. 1,4 laisse les pastels lisibles sans les
 * transformer en gris.
 */
export const CONTRASTE_MIN_PERSO = 1.4

/** Luminance relative WCAG d'un `#RRGGBB`. */
function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255)
}

/** Contraste WCAG entre deux `#RRGGBB`, toujours >= 1. */
export function contraste(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * La teinte libre telle qu'elle sera RENDUE : assez sombre pour ne jamais se
 * confondre avec le fond, sinon un `#ffffff` choisi au selecteur donnait un
 * export entierement blanc. On assombrit en multipliant les trois canaux par le
 * meme facteur, ce qui garde la teinte ; une couleur deja lisible ressort telle
 * quelle. Les presets ne passent pas par ici : ils sont fixes.
 */
export function teinteLisible(hex: string): string {
  const fond = luminance(FOND_LE_PLUS_SOMBRE)
  const tient = (h: string) => luminance(h) < fond && contraste(h, FOND_LE_PLUS_SOMBRE) >= CONTRASTE_MIN_PERSO
  if (tient(hex)) return hex
  const v = parseInt(hex.slice(1), 16)
  const canaux = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  const fois = (k: number) =>
    `#${canaux.map((c) => Math.floor(c * k).toString(16).padStart(2, '0')).join('')}`
  // dichotomie sur le facteur : le plus clair qui tient encore
  let bas = 0
  let haut = 1
  for (let i = 0; i < 24; i++) {
    const milieu = (bas + haut) / 2
    if (tient(fois(milieu))) bas = milieu
    else haut = milieu
  }
  return fois(bas)
}
