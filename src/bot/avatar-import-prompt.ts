/**
 * Prompts adresses a un agent de conversation EXTERNE : generation d'un
 * avatar au format Open Bot Avatar JSON v1, puis reparation d'un essai refuse.
 *
 * Le gabarit de generation condense le « design prompt » canonique du projet
 * open-bot-avatar (MIT, © 2026 Dominik Scholz —
 * skills/generate-avatar/references/system-prompt.md, revu au commit 5e64c08) :
 * le schema de sortie, les bornes geometriques et la philosophie « face
 * first » y sont repris. Tout le reste est propre a Bloub : les contraintes
 * RADIALES que le moteur d'import verifie (rayons uniques depuis le centre du
 * visage, pas de trous ni de pieces detachees) y sont dit a l'agent POUR
 * EVITER la boucle de reparation d'entrer en jeu.
 *
 * Volontairement en anglais, quelle que soit la langue de l'interface : le
 * prompt est copie vers un agent dont ce n'est pas la langue native
 * presupposee, et c'est aussi la langue des diagnostics renvoyes par la
 * validation. Le reste de l'interface, lui, est traduit (AvatarImportTextes).
 */

/** Longueur garde-fou de la description inseree dans un prompt. */
export const MAX_DESCRIPTION = 400

/** Tronque une description d'agent : espaces collapsees, taille bornee. */
export function nettoieDescription(d: string): string {
  const clean = d.replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_DESCRIPTION) return clean
  return `${clean.slice(0, MAX_DESCRIPTION - 1)}…`
}

/** Le schema de sortie, pour le rappeler dans les deux prompts. */
const SCHEMA =
  '{"version":1,"id":"slug","name":"Name","body":{"path":"M… Z"},"eyes":{"x":50,"y":46,"spacing":15,"scale":1}}'

/**
 * Prompt de generation : l'utilisateur y decrit l'avatar, l'agent externe
 * repond le JSON seul.
 */
export function promptGeneration(description: string): string {
  const sujet = nettoieDescription(description) || 'a cute round bot companion'
  return [
    'You design one avatar for Bloub, a small vector character engine, and you answer with JSON only.',
    '',
    'The avatar is described in the user\'s own words (at the end). You write GEOMETRY ONLY: one filled silhouette plus the placement of the eyes. The engine adds color, gaze, blinking and animation itself — never output any of those.',
    '',
    `Reply with ONLY the JSON, on one line, no prose, no code fence:`,
    '',
    SCHEMA,
    '',
    'Schema and bounds — the Open Bot Avatar v1 contract:',
    '- Canvas is a fixed "0 0 100 100" SVG viewBox, y pointing down. Keep all geometry within 8..92 (rejected outside 6..94).',
    '- "body.path" is one filled SVG path using only the commands M L H V C S Q T A Z, absolute or relative, arc flags written as separate 0 or 1. At most 16 subpaths, 400 segments, 6000 characters; aim for well under 1500.',
    '- "id" is a lowercase slug of 1-40 chars (a-z, 0-9, inner -). "name" is 1-40 printable characters, a short conventional display name. "version" is 1. No other field at any level.',
    '- The body must span at least 40 units on its long side and 14 on its short side, with at least 600 square units of fill.',
    '- "eyes": "x","y" is the center of the pair, "spacing" is center-to-center, "scale" 0.6..1.8 (1..1.15 typical, spacing 15..18 with it). At scale 1 each eye is a 4 x 11 vertical pill.',
    '',
    'Bloub converts the silhouette into a RADIAL PROFILE of 64 rays cast from the eyes\' center, and REFUSES any shape where a ray does not meet the outline exactly once:',
    '- Draw the body as ONE single closed outline ending in Z — no holes, no cut-outs, no detached parts: trace every detail into that one outline.',
    '- The outline must be star-shaped around the eyes: no handle sticking sideways, no arm reaching around, no ring, no two masses joined by a thin bar. Round, plump, softly lumpy outlines are ideal.',
    '- No thin spikes, teeth or needles, and no feature narrower than about 5 degrees of arc seen from the eyes: the 64-ray sampling would drop it.',
    '- Keep it roundish: the narrowest width of the silhouette must stay above 42% of its longest dimension.',
    '- Put "eyes" at the center of the main mass — rays are cast from it — a little above its middle, and keep calm solid fill all around the face (the engine draws the eyes bigger than their nominal size).',
    '',
    'The look: a soft, chunky blob of a few rounded lobes carrying just enough of the object\'s silhouette to be named at 28 px. Toy proportions, corner radii of 3+ units, C curves over polygons. The face part is the dominant mass; secondary parts read first after it. Judge the whole at thumbnail size: it must read as the object, not as a broken blob.',
    '',
    `Avatar to design: ${sujet}`
  ].join('\n')
}

/**
 * Prompt de reparation : renvoie a l'agent le JSON refuse avec les
 * diagnostics de la validation. `json` est tronque a la borne du prompt —
 * un essai refuse sera toujours court, la garde n'est la que pour la forme.
 */
export function promptReparation(description: string, json: string, diagnostics: readonly string[]): string {
  const sujet = nettoieDescription(description)
  const extrait = json.length > 2000 ? `${json.slice(0, 2000)}\n… (truncated)` : json
  return [
    'The avatar JSON you wrote for Bloub was rejected by the engine\'s validation. Fix the geometry so that every rule passes.',
    '',
    `Reply with ONLY the corrected JSON on one line, no prose, no code fence. Same schema: ${SCHEMA}`,
    '',
    'What was rejected:',
    extrait,
    '',
    'Why it was rejected:',
    ...diagnostics.map((d) => `- ${d}`),
    '',
    'Remember the target engine: the body is ONE closed outline (Z), star-shaped around the eyes — no holes, no detached parts, no handle — within 8..92 of the "0 0 100 100" viewBox, no thin spikes.',
    sujet ? `The avatar to draw is still: ${sujet}.` : 'Keep the spirit of the original design; only fix what the errors above name.'
  ].filter(Boolean).join('\n')
}
