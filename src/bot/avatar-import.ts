/**
 * Import d'avatar « Open Bot Avatar JSON v1 » vers une forme de Bloub.
 *
 * Le parcours : l'utilisateur decrit l'avatar, copie le prompt de generation
 * (`avatar-import-prompt.ts`) vers n'importe quel agent de conversation, colle
 * le JSON renvoye ici, et Bloub le convertit en profil radial — 64 rayons
 * positifs, la representation unique du moteur. Ce module ne fait AUCUN
 * appel de modele : l'agent est externe, interpose par l'utilisateur.
 *
 * La validation structurelle (champs, bornes, logement des yeux) adapte
 * `packages/core/src/validate.ts` du projet open-bot-avatar (MIT, © 2026
 * Dominik Scholz, revu au commit 5e64c08) : un JSON valide ici l'est aussi
 * pour le renderer d'origine, et un JSON refuse s'explique dans les memes
 * termes — le prompt de reparation reste comprehensible pour un agent qui
 * connait ce contrat. A cela s'ajoutent les refus propres a Bloub (formes
 * non radiales, trop approximatives, trop aplaties) poses par
 * `avatar-import-profil.ts`.
 *
 * Aucune trace du JSON ne survit a l'import : ni le chemin (jamais reinjecte
 * dans un SVG), ni les yeux — seuls le nom et les 64 rayons sont gardes, et
 * le nom ne franchit le DOM que par l'interpolation de Vue. Pas d'injection
 * SVG possible par construction.
 */

import { aplatir, airePleine, bornes, enroulement, ErreurChemin, parseChemin, type Point } from './avatar-import-chemin'
import { normalise, sonde } from './avatar-import-profil'
import { PROFILE_SAMPLES } from './profiles'

/*
 * Le contrat d'integration, ce que le parent (App.vue, Customizer.vue) lit.
 * `id` est fabrique par l'import : « perso- » + le slug du JSON d'origine.
 */
export type ImportedAvatar = {
  id: `perso-${string}`
  name: string
  radii: number[]
}

/** Plafond du texte colle dans l'import : une borne de ressources, pas de clemence. */
export const MAX_TEXTE = 65536

/**
 * Pire ecart tolere entre la vraie silhouette et son profil de 64 rayons, en
 * fraction du rayon moyen. Au-dela la representation perd des dents ou des
 * creux que l'oeil verra encore : la forme est trop approximative pour Bloub.
 */
export const SEUIL_APPROX = 0.08

/**
 * Largeur minimale de la silhouette (r minimal / r maximal), pour que les
 * yeux et les morphs de Bloub aient de la matiere : sous ce rapport la forme
 * n'est qu'une gelule, et le moteur ne la porte pas.
 */
export const SEUIL_PLAT = 0.42

/** Limite de SECURITE de la rehydration : au-dela, le stockage est ignore. */
export const MAX_STOCKEES = 32
/** Longueur au-dela de laquelle le contenu stocke n'est meme pas analyse. */
export const MAX_STOCKAGE = 262144

/** Codes stables de diagnostics, pour la couche UI FR EN ZH (AvatarImportTextes). */
export type CodeDiagnostic =
  | 'json.tropLong'
  | 'json.invalide'
  | 'racine'
  | 'champ'
  | 'version'
  | 'id'
  | 'nom'
  | 'corps'
  | 'chemin'
  | 'bornes'
  | 'minuscule'
  | 'aire'
  | 'yeux'
  | 'yeux.nombres'
  | 'yeux.echelle'
  | 'yeux.espacement'
  | 'yeux.dehors'
  | 'bloub.radial'
  | 'bloub.approximatif'
  | 'bloub.plat'

export interface Diagnostic {
  code: CodeDiagnostic
  /** Message canonique en anglais : ce que le prompt de reparation renvoie a l'agent. */
  en: string
  /** Valeurs d'interpolation pour les locales FR et ZH. */
  valeurs?: Record<string, string | number>
}

export interface RapportImport {
  avatar: ImportedAvatar | null
  diagnostics: Diagnostic[]
}

/* --------------------------------------------------------- contrat v1 OBA */

const CLES_HAUT = ['version', 'id', 'name', 'body', 'eyes']
const CLES_YEUX = ['x', 'y', 'spacing', 'scale']

/** Taille d'un oeil neutre a l'echelle 1, en unites viewBox (contrat v1). */
const OEIL_L = 4
const OEIL_H = 11
/** Marge exigeee autour des deux yeux sur du plein (contrat v1). */
const MARGE_YEUX = 1.2
/** Bornes dures du corps ; la cible douce du contrat est 8..92. */
const CORPS_MIN = 6
const CORPS_MAX = 94

const r1 = (n: number) => Math.round(n * 10) / 10

function estRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function estNombre(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Contour du pilule d'un oeil, dilate de la marge. Repris de validate.ts (MIT). */
function contourOeil(cx: number, cy: number, echelle: number, marge: number): Point[] {
  const dm = (OEIL_L * echelle) / 2 + marge
  const hm = (OEIL_H * echelle) / 2 + marge
  const droit = Math.max(0, hm - dm)
  const pts: Point[] = []
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    pts.push([cx + Math.cos(a) * dm, cy + Math.sin(a) * dm + Math.sign(Math.sin(a)) * droit])
  }
  // flancs droits du pilule, ou la couronne de 16 points laisse un creux
  for (const f of [-0.5, 0, 0.5]) {
    pts.push([cx - dm, cy + f * droit], [cx + dm, cy + f * droit])
  }
  pts.push([cx, cy])
  return pts
}

/* ------------------------------------------------------------ extraction */

/**
 * Recupere le JSON dans le texte colle. Les agents repondent parfois une
 * cloture de code malgre l'instruction : on degage les clotures puis on prend
 * la premiere accolade equilibree, sans rien interpreter du contenu.
 */
function extraitJson(texte: string): string {
  const sansCloture = texte.replace(/```[a-z]*\s*/gi, '').trim()
  const debut = sansCloture.indexOf('{')
  if (debut < 0) return sansCloture
  let profondeur = 0
  let dansChaine = false
  let echappe = false
  for (let i = debut; i < sansCloture.length; i++) {
    const c = sansCloture[i]!
    if (dansChaine) {
      if (echappe) echappe = false
      else if (c === '\\') echappe = true
      else if (c === '"') dansChaine = false
      continue
    }
    if (c === '"') dansChaine = true
    else if (c === '{') profondeur++
    else if (c === '}') {
      profondeur--
      if (profondeur === 0) return sansCloture.slice(debut, i + 1)
    }
  }
  return sansCloture.slice(debut)
}

/* ------------------------------------------------------- validation v1 */

interface ChampsV1 {
  slug: string
  name: string
  chemin: string
  yeux: { x: number; y: number; spacing: number; scale: number }
}

/** Champs, types et bornes du contrat v1. Sans pretention geometrique. */
function valideStructure(entree: unknown): { champs: ChampsV1 | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  if (!estRecord(entree)) {
    diagnostics.push({ code: 'racine', en: 'the definition must be a single JSON object' })
    return { champs: null, diagnostics }
  }
  for (const k of Object.keys(entree))
    if (!CLES_HAUT.includes(k))
      diagnostics.push({ code: 'champ', en: `unknown field "${k}" (allowed: ${CLES_HAUT.join(', ')})`, valeurs: { champ: k } })
  if (entree.version !== 1) diagnostics.push({ code: 'version', en: 'version must be 1' })

  const id = entree.id
  if (typeof id !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(id)) {
    diagnostics.push({ code: 'id', en: 'id must be a lowercase slug of 1-40 chars [a-z0-9-]' })
  }
  const name = typeof entree.name === 'string' ? entree.name.trim() : ''
  if (!name || name.length > 40 || /[\u0000-\u001f<>]/.test(name)) {
    diagnostics.push({ code: 'nom', en: 'name must be 1-40 printable characters without < or >' })
  }

  let chemin: string | null = null
  if (!estRecord(entree.body)) {
    diagnostics.push({ code: 'corps', en: 'body must be an object { "path": "…" }' })
  } else {
    if (Object.keys(entree.body).some((k) => k !== 'path'))
      diagnostics.push({ code: 'corps', en: 'body may only contain "path"' })
    if (typeof entree.body.path !== 'string') {
      diagnostics.push({ code: 'corps', en: 'body.path must be a string' })
    } else chemin = entree.body.path
  }

  let yeux: ChampsV1['yeux'] | null = null
  if (!estRecord(entree.eyes)) {
    diagnostics.push({ code: 'yeux', en: 'eyes must be an object { x, y, spacing, scale }' })
  } else {
    const e = entree.eyes
    for (const k of Object.keys(e))
      if (!CLES_YEUX.includes(k))
        diagnostics.push({
          code: 'champ',
          en: `unknown field "eyes.${k}" (allowed: ${CLES_YEUX.join(', ')})`,
          valeurs: { champ: `eyes.${k}` }
        })
    const manquants = CLES_YEUX.filter((k) => !estNombre(e[k]))
    if (manquants.length) {
      diagnostics.push({
        code: 'yeux.nombres',
        en: `eyes.${manquants.join(', eyes.')} must be finite numbers`,
        valeurs: { champs: manquants.map((k) => `eyes.${k}`).join(', ') }
      })
    } else {
      yeux = { x: e.x as number, y: e.y as number, spacing: e.spacing as number, scale: e.scale as number }
      if (yeux.scale < 0.6 || yeux.scale > 1.8) {
        diagnostics.push({
          code: 'yeux.echelle',
          en: `eyes.scale ${yeux.scale} is out of range 0.6..1.8`,
          valeurs: { echelle: yeux.scale }
        })
      }
      const espacementMin = OEIL_L * yeux.scale * 1.75
      if (yeux.spacing < espacementMin || yeux.spacing > 40) {
        diagnostics.push({
          code: 'yeux.espacement',
          en: `eyes.spacing ${yeux.spacing} is out of range ${r1(espacementMin)}..40 for scale ${yeux.scale}`,
          valeurs: { espacement: yeux.spacing, min: r1(espacementMin), echelle: yeux.scale }
        })
      }
    }
  }

  if (typeof id !== 'string' || !name || chemin === null || yeux === null) {
    return { champs: null, diagnostics }
  }
  return { champs: { slug: id, name, chemin, yeux }, diagnostics }
}

/* ---------------------------------------------------------------- import */

/**
 * Valide et convertit un texte colle. Renvoie TOUJOURS un rapport, jamais
 * d'exception : la fonction est appelee a chaque frappe. Tous les couts sont
 * bornes par les LIMITES_CHEMIN et le pas fixe des sondes.
 */
export function importerAvatar(texte: string): RapportImport {
  const brut = texte.trim()
  if (!brut) return { avatar: null, diagnostics: [] }
  if (brut.length > MAX_TEXTE) {
    return {
      avatar: null,
      diagnostics: [{ code: 'json.tropLong', en: `the pasted text exceeds ${MAX_TEXTE} characters`, valeurs: { n: MAX_TEXTE } }]
    }
  }

  let entree: unknown
  try {
    entree = JSON.parse(extraitJson(brut))
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'invalid JSON'
    return { avatar: null, diagnostics: [{ code: 'json.invalide', en: `the text is not valid JSON: ${detail}`, valeurs: { detail } }] }
  }

  const { champs, diagnostics } = valideStructure(entree)
  if (!champs) return { avatar: null, diagnostics }

  // geometrie : parse, aplatissement, puis les refus v1 de place et de taille
  let polys: Point[][] = []
  try {
    polys = aplatir(parseChemin(champs.chemin))
  } catch (err) {
    if (err instanceof ErreurChemin) {
      return { avatar: null, diagnostics: [...diagnostics, { code: 'chemin', en: `body.path: ${err.message}`, valeurs: { detail: err.message } }] }
    }
    throw err
  }
  if (!polys.length) {
    return { avatar: null, diagnostics: [...diagnostics, { code: 'chemin', en: 'body.path flattens to nothing (at least 3 distinct points per outline are needed)' }] }
  }

  const b = bornes(polys)
  const debords: string[] = []
  if (b.minX < CORPS_MIN) debords.push(`left edge x=${r1(b.minX)}`)
  if (b.minY < CORPS_MIN) debords.push(`top edge y=${r1(b.minY)}`)
  if (b.maxX > CORPS_MAX) debords.push(`right edge x=${r1(b.maxX)}`)
  if (b.maxY > CORPS_MAX) debords.push(`bottom edge y=${r1(b.maxY)}`)
  if (debords.length) {
    diagnostics.push({
      code: 'bornes',
      en: `body.path leaves the safe area (${debords.join(', ')}); keep geometry within 8..92`,
      valeurs: { detail: debords.join(', ') }
    })
  }
  const l = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (Math.max(l, h) < 40 || Math.min(l, h) < 14) {
    diagnostics.push({
      code: 'minuscule',
      en: `body is too small (${r1(l)}x${r1(h)}); use at least 40 units on the long side and 14 on the short side`,
      valeurs: { l: r1(l), h: r1(h) }
    })
  }
  const aire = airePleine(polys, b)
  if (aire < 600) {
    diagnostics.push({
      code: 'aire',
      en: `body fill area ${aire} is too thin to carry eyes; must be at least 600 square units`,
      valeurs: { aire }
    })
  }
  // les deux yeux, marge comprise, doivent dormir sur du plein
  const { x, y, spacing, scale } = champs.yeux
  for (const cote of [-1, 1] as const) {
    const cx = x + (cote * spacing) / 2
    for (const [px, py] of contourOeil(cx, y, scale, MARGE_YEUX)) {
      if (enroulement(polys, px, py) === 0) {
        diagnostics.push({
          code: 'yeux.dehors',
          en: `eyes must sit inside the body with ${MARGE_YEUX} units of margin; point (${r1(px)}, ${r1(py)}) is outside or in a hole. Move eyes.x/y toward the widest solid area, reduce spacing or scale.`,
          valeurs: { x: r1(px), y: r1(py) }
        })
        break
      }
    }
  }

  // refus propres a Bloub : radialite d'abord, puis les metriques de qualite
  const profil = sonde(polys, x, y)
  if (!profil.radial) {
    diagnostics.push({
      code: 'bloub.radial',
      en: `the silhouette is not radial from the eyes (first offending ray at ${Math.round(profil.angleFautif)} degrees): Bloub keeps 64 rays cast from the eyes' center, and each must meet the outline exactly once. Remove holes, detached parts, handles and deep concavities.`,
      valeurs: { degres: Math.round(profil.angleFautif) }
    })
    return { avatar: null, diagnostics }
  }
  if (profil.approximation > SEUIL_APPROX) {
    diagnostics.push({
      code: 'bloub.approximatif',
      en: `the silhouette is too detailed for Bloub's 64 rays: mid-sector outlines drift up to ${Math.round(profil.approximation * 100)}% of the mean radius from the sampled profile (limit ${Math.round(SEUIL_APPROX * 100)}%). Use fewer, wider features or rounded teeth.`,
      valeurs: { pct: Math.round(profil.approximation * 100), max: Math.round(SEUIL_APPROX * 100) }
    })
  }
  if (profil.aplatissement < SEUIL_PLAT) {
    diagnostics.push({
      code: 'bloub.plat',
      en: `the silhouette is too flat for Bloub's morphs: its narrowest width is only ${Math.round(profil.aplatissement * 100)}% of its longest span (at least ${Math.round(SEUIL_PLAT * 100)}% needed). Make it plumper.`,
      valeurs: { pct: Math.round(profil.aplatissement * 100), min: Math.round(SEUIL_PLAT * 100) }
    })
  }

  if (diagnostics.length) return { avatar: null, diagnostics }

  return {
    avatar: {
      id: `perso-${champs.slug}`,
      name: champs.name,
      radii: normalise(profil.radii)
    },
    diagnostics: []
  }
}

/* ---------------------------------------------------------- rehydratation */

/** Un id d'avatar importe : « perso- » + le slug du contrat v1. */
const RE_ID = /^perso-[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

/** Un avatar relu du stockage, ou null si l'entree n'a pas la forme. */
function avatarValide(v: unknown): ImportedAvatar | null {
  if (!estRecord(v)) return null
  if (typeof v.id !== 'string' || !RE_ID.test(v.id)) return null
  if (typeof v.name !== 'string') return null
  const nom = v.name.trim()
  if (!nom || nom.length > 40 || /[\u0000-\u001f<>]/.test(nom)) return null
  if (!Array.isArray(v.radii) || v.radii.length !== PROFILE_SAMPLES) return null
  for (const r of v.radii) {
    if (!estNombre(r) || r < 0.45 || r > 1.08) return null
  }
  return { id: v.id as `perso-${string}`, name: nom, radii: v.radii.map(Number) }
}

/**
 * Rehydration GARDEE des avatars stockes : `brut` est ce que le parent a
 * ecrit dans `bloub:formes` — le JSON d'un `ImportedAvatar[]`. Chaque entree
 * qui n'a pas la forme est SAUTEE (une instalation ou un localStorage truque
 * ne peut pas faire pire que perdre ce qui est deja perdu), la liste est
 * dedoublonnee par id, cappee a `MAX_STOCKEES`, et la fonction ne leve
 * jamais : une relecture ratee rend une liste vide, pas une page blanche —
 * meme arbitrage que `lis` de `stockage.ts`.
 */
export function parseStoredAvatars(brut: string | null): ImportedAvatar[] {
  if (!brut || brut.length > MAX_STOCKAGE) return []
  let lus: unknown
  try {
    lus = JSON.parse(brut)
  } catch {
    return []
  }
  if (!Array.isArray(lus)) return []
  const vus = new Set<string>()
  const avatars: ImportedAvatar[] = []
  for (const candidate of lus) {
    if (avatars.length >= MAX_STOCKEES) break
    const avatar = avatarValide(candidate)
    if (!avatar || vus.has(avatar.id)) continue
    vus.add(avatar.id)
    avatars.push(avatar)
  }
  return avatars
}
