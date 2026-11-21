/**
 * Textes du parcours d'import d'avatar : interface ET diagnostics.
 *
 * Independant du dictionnaire d'i18n (que le parent integre) mais branche sur
 * sa LANGUE existante : `langue` de `@/i18n` reste LA source de verite, ce
 * module n'ajoute aucune cle a `locales/*.ts`. Le contrat posture ici est le
 * meme que celui des locales maison : completer un glossaire pour une langue
 * et pas une autre fait echouer `vue-tsc` (Record<Langue, TextesIu>).
 *
 * Particularite de ce module : le message ANGLAIS d'un diagnostic ne vit pas
 * ici. Il est emis avec le diagnostic par la couche bot (`diagnostic.en`,
 * canonique, en anglais) puisque c'est aussi ce que le prompt de reparation
 * renvoie a l'agent — l'anglais n'est donc ecrit QU'UNE fois. Ici ne vivent
 * que ses traductions francaise et chinoise.
 */

import type { CodeDiagnostic, Diagnostic } from '@/bot/avatar-import'
import type { Langue } from '@/i18n/langues'

/** Substitution `{nom}` — copie mince d'`interpoler` de `i18n/format`, pour rester independant des fichiers du parent. */
function interpole(gabarit: string, valeurs?: Record<string, string | number>): string {
  if (!valeurs) return gabarit
  let sortie = gabarit
  for (const [nom, valeur] of Object.entries(valeurs)) {
    sortie = sortie.replaceAll(`{${nom}}`, String(valeur))
  }
  return sortie
}

/** Tout ce que le composant affiche, par langue. */
export interface TextesIu {
  titre: string
  fermer: string
  ongletGenerer: string
  ongletImporter: string
  generationIntro: string
  generationLangue: string
  descriptionLabel: string
  descriptionPlaceholder: string
  copier: string
  copie: string
  importIntro: string
  collePlaceholder: string
  choisirFichier: string
  erreurFichier: string
  valide: string
  apercu: string
  ajouter: string
  diagnosticsIntro: string
  reparationIntro: string
  copierReparation: string
}

const UI: Record<Langue, TextesIu> = {
  fr: {
    titre: 'Ajouter une forme importée',
    fermer: 'Fermer',
    ongletGenerer: 'Générer',
    ongletImporter: 'Importer',
    generationIntro:
      'Décris l’avatar, copie le prompt vers n’importe quel agent de conversation, puis colle le JSON qu’il renvoie dans l’onglet Importer.',
    generationLangue: 'Prompt en anglais : envoie-le tel quel, l’agent et son JSON restent standards.',
    descriptionLabel: 'Description de l’avatar',
    descriptionPlaceholder: 'un robot avocat dodu, tout vert…',
    copier: 'Copier le prompt',
    copie: 'Copié',
    importIntro:
      'Colle ici le JSON renvoyé par l’agent. Bloub le valide, le convertit en profil radial de 64 rayons puis l’ajoute aux formes du personnalisateur.',
    collePlaceholder: '{"version":1,"id":"nouveau-bot","name":"…","body":{"path":"…"},"eyes":{…}}',
    choisirFichier: 'Ouvrir un fichier JSON',
    erreurFichier: 'Impossible de lire ce fichier JSON (64 Ko maximum).',
    valide: 'Silhouette valide : rien du JSON ne survit, Bloub n’en garde que le nom et 64 rayons.',
    apercu: 'Aperçu de la silhouette',
    ajouter: 'Ajouter la forme',
    diagnosticsIntro: 'Import refusé :',
    reparationIntro: 'Copie ce prompt de réparation et renvoie-le à l’agent pour retenter :',
    copierReparation: 'Copier le prompt de réparation'
  },
  en: {
    titre: 'Add an imported shape',
    fermer: 'Close',
    ongletGenerer: 'Generate',
    ongletImporter: 'Import',
    generationIntro:
      'Describe the avatar, copy the prompt to any chat agent, then paste the JSON it returns in the Import tab.',
    generationLangue: 'The prompt is in English: send it as is — it and the JSON stay standard.',
    descriptionLabel: 'Avatar description',
    descriptionPlaceholder: 'a plump all-green lawyer robot…',
    copier: 'Copy the prompt',
    copie: 'Copied',
    importIntro:
      'Paste the JSON the agent returned. Bloub validates it, turns it into a 64-ray radial profile, then adds it to your shapes.',
    collePlaceholder: '{"version":1,"id":"new-bot","name":"…","body":{"path":"…"},"eyes":{…}}',
    choisirFichier: 'Open a JSON file',
    erreurFichier: 'Could not read this JSON file (64 KB maximum).',
    valide: 'Valid silhouette: nothing of the JSON survives — Bloub keeps only its name and 64 rays.',
    apercu: 'Silhouette preview',
    ajouter: 'Add the shape',
    diagnosticsIntro: 'Import refused:',
    reparationIntro: 'Copy this repair prompt and send it back to the agent to try again:',
    copierReparation: 'Copy the repair prompt'
  },
  zh: {
    titre: '添加导入的形状',
    fermer: '关闭',
    ongletGenerer: '生成',
    ongletImporter: '导入',
    generationIntro: '描述你想要的头像，把提示词复制给任意对话智能体，再把它返回的 JSON 粘贴到“导入”标签页。',
    generationLangue: '提示词是英文的：直接发送即可，它和返回的 JSON 都是标准格式。',
    descriptionLabel: '头像描述',
    descriptionPlaceholder: '一个圆滚滚、通体绿色的律师机器人…',
    copier: '复制提示词',
    copie: '已复制',
    importIntro: '粘贴智能体返回的 JSON。Bloub 会校验它，转换成 64 条半径的径向轮廓，并加入个性化形状列表。',
    collePlaceholder: '{"version":1,"id":"new-bot","name":"…","body":{"path":"…"},"eyes":{…}}',
    choisirFichier: '打开 JSON 文件',
    erreurFichier: '无法读取此 JSON 文件（最大 64 KB）。',
    valide: '轮廓有效：原 JSON 不会保留，只留下名称和 64 条半径。',
    apercu: '轮廓预览',
    ajouter: '添加形状',
    diagnosticsIntro: '导入被拒绝：',
    reparationIntro: '复制下面的修复提示词发回给智能体，让它重试：',
    copierReparation: '复制修复提示词'
  }
}

/** Un texte d’interface dans la langue demandee, valeurs interpolees en option. */
export function texte(lang: Langue, cle: keyof TextesIu, valeurs?: Record<string, string | number>): string {
  return interpole(UI[lang][cle], valeurs)
}

/**
 * Traductions des diagnostics. L’anglais n’y figure pas : il vit avec le
 * diagnostic, emis par la couche bot (`diagnostic.en`), parce que c’est le
 * meme texte que le prompt de reparation renvoie a l’agent.
 */
const DIAGNOSTICS_FR: Record<CodeDiagnostic, string> = {
  'json.tropLong': 'Le texte collé dépasse {n} caractères',
  'json.invalide': 'Le texte n’est pas du JSON valide : {detail}',
  racine: 'La définition doit être un objet JSON unique',
  champ: 'Champ inconnu « {champ} »',
  version: 'version doit valoir 1',
  id: 'id doit être un identifiant en minuscules de 1 à 40 caractères [a-z0-9-]',
  nom: 'name doit faire 1 à 40 caractères imprimables, sans < ni >',
  corps: 'body doit être un objet dont le seul champ est "path"',
  chemin: 'path invalide : {detail}',
  bornes: 'Le corps sort de la zone sûre ({detail}) ; garde la géométrie entre 8 et 92',
  minuscule: 'Corps trop petit ({l} × {h}) ; au moins 40 unités sur le grand côté, 14 sur le petit',
  aire: 'Le plein du corps ({aire} unités²) est trop maigre pour porter des yeux ; il en faut au moins 600',
  yeux: 'eyes doit être un objet { x, y, spacing, scale }',
  'yeux.nombres': 'Les champs {champs} doivent être des nombres finis',
  'yeux.echelle': 'eyes.scale {echelle} sort de la plage 0.6..1.8',
  'yeux.espacement': 'eyes.spacing {espacement} sort de la plage {min}..40 pour cette échelle',
  'yeux.dehors':
    'Les yeux doivent dormir sur du plein avec une marge de 1,2 unités : le point ({x}, {y}) est dehors ou dans un trou. Rapproche-les du plein le plus large, ou réduis spacing/échelle.',
  'bloub.radial':
    'La silhouette n’est pas radiale depuis les yeux (premier rayon fautif à {degres} degrés) : Bloub garde 64 rayons lancés depuis les yeux, et chacun doit rencontrer le contour une seule fois. Supprime les trous, pièces détachées, anses et concavités profondes.',
  'bloub.approximatif':
    'Silhouette trop détaillée pour les 64 rayons : jusqu’à {pct} % d’écart au rayon moyen (limite {max} %). Élargis les détails ou arrondis les dents.',
  'bloub.plat':
    'Silhouette trop aplatie pour les morphs de Bloub : sa largeur minimale fait {pct} % de sa portée maximale ({min} % requis). Rends-la plus dodue.'
}

const DIAGNOSTICS_ZH: Record<CodeDiagnostic, string> = {
  'json.tropLong': '粘贴的文本超过 {n} 个字符',
  'json.invalide': '不是有效的 JSON：{detail}',
  racine: '定义必须是单个 JSON 对象',
  champ: '未知字段“{champ}”',
  version: 'version 必须为 1',
  id: 'id 必须是 1–40 个字符的小写标识 [a-z0-9-]',
  nom: 'name 必须是 1–40 个可显示字符，不含 < 和 >',
  corps: 'body 必须是只含 "path" 的对象',
  chemin: 'path 无效：{detail}',
  bornes: '身体超出安全区（{detail}）；请保持在 8..92 以内',
  minuscule: '身体太小（{l} × {h}）；长边至少 40 单位，短边至少 14',
  aire: '身体填充面积 {aire} 太小，装不下眼睛；至少需要 600 平方单位',
  yeux: 'eyes 必须是 { x, y, spacing, scale } 对象',
  'yeux.nombres': '{champs} 必须是有限数字',
  'yeux.echelle': 'eyes.scale {echelle} 超出 0.6..1.8 的范围',
  'yeux.espacement': 'eyes.spacing {espacement} 对该 scale 超出 {min}..40 的范围',
  'yeux.dehors': '双眼必须留在填充内并留有 1.2 单位边距；点 ({x}, {y}) 在外部或孔洞中',
  'bloub.radial':
    '轮廓从双眼出发不是径向的（第一条出错射线在 {degres} 度）：Bloub 只保留从双眼中心发出的 64 条射线，每条只能与轮廓相交一次。请去掉孔洞、分离部件、把手和深凹。',
  'bloub.approximatif': '轮廓对 64 条射线来说太细碎：与平均半径的偏差达 {pct} %（上限 {max} %）。请减少细节或加宽特征。',
  'bloub.plat': '轮廓对 Bloub 的变形来说太扁：最小宽度只有最大跨度的 {pct} %（至少 {min} %）。请画得饱满一些。'
}

/** Le message d’un diagnostic, dans la langue de l’interface. */
export function messageDiagnostic(lang: Langue, diagnostic: Diagnostic): string {
  if (lang === 'en') return diagnostic.en
  const gabarit = lang === 'fr' ? DIAGNOSTICS_FR[diagnostic.code] : DIAGNOSTICS_ZH[diagnostic.code]
  return interpole(gabarit, diagnostic.valeurs)
}
