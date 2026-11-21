// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createApp, h } from 'vue'
import { importerAvatar, type ImportedAvatar } from '@/bot/avatar-import'
import { PROFILE_SAMPLES } from '@/bot/profiles'
import { langue } from '@/i18n'
import AvatarImport from './AvatarImport.vue'
import { messageDiagnostic, texte } from './AvatarImportTextes'

/**
 * L'avatar, teste comme le parent le monte (v-if sur son bouton d'ajout) :
 * createApp + h, sans librairie de test — le depot n'en a pas, et
 * `capture.test.ts` a fixe l'usage. On verifie le CABLE du contrat : le prompt
 * copiable contient la description, l'onglet Importer valide le JSON colle,
 * l'ajout emet l'avatar exact que le parent doit persister, et la fermeture
 * emet close. Les messages compares passent par le meme module de textes,
 * dans la langue effective de l'i18n : l'assert verifie donc le cablage
 * (diagnostic -> traduction -> rendu), pas la traduction elle-meme.
 */

const ETOILE = `{"version":1,"id":"star","name":"Star","body":{"path":"M53.7 17.95L62 31.2Q64.1 34.6 68 35.6L83.1 39.3Q89.9 41 85.4 46.4L75.4 58.3Q72.8 61.4 73.1 65.4L74.2 81Q74.7 88 68.2 85.4L53.7 79.5Q50 78 46.3 79.5L31.8 85.4Q25.3 88 25.8 81L26.9 65.4Q27.2 61.4 24.6 58.3L14.6 46.4Q10.1 41 16.9 39.3L32 35.6Q35.9 34.6 38 31.2L46.3 17.95Q50 12 53.7 17.95Z"},"eyes":{"x":50,"y":52,"spacing":16,"scale":1.1}}`

interface Montage {
  hote: HTMLElement
  importes: ImportedAvatar[]
  /** Accesseur, pas valeur : la closure du montage incremente son propre
   * compteur, un nombre retourne une fois resterait fige a zero. */
  fermetures: () => number
  demonte: () => void
}

async function monte(): Promise<Montage> {
  const importes: ImportedAvatar[] = []
  let fermetures = 0
  const app = createApp({
    render: () =>
      h(AvatarImport, {
        onImport: (avatar: ImportedAvatar) => importes.push(avatar),
        onClose: () => fermetures++
      })
  })
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  app.mount(hote)
  await nextTick()
  return { hote, importes, fermetures: () => fermetures, demonte: () => app.unmount() }
}

/** Passe a l'onglet Importer. */
async function versImporter(m: Montage) {
  const onglets = m.hote.querySelectorAll<HTMLButtonElement>('[aria-pressed]')
  onglets[1]!.click()
  await nextTick()
}

/** Colle un texte dans la zone d'import, comme un collage utilisateur. */
async function colle(m: Montage, texte: string) {
  const zone = m.hote.querySelector<HTMLTextAreaElement>('textarea')!
  zone.value = texte
  zone.dispatchEvent(new Event('input'))
  await nextTick()
}

/** bouton d'ajout : le dernier bouton principal de l'onglet Importer. */
function boutonAjouter(m: Montage) {
  return [...m.hote.querySelectorAll<HTMLButtonElement>('button')].at(-1)!
}

describe('AvatarImport', () => {
  it('s’ouvre sur l’onglet Generer avec le prompt copiable', async () => {
    const m = await monte()
    try {
      const zones = m.hote.querySelectorAll('textarea')
      expect(zones).toHaveLength(1)
      const pre = m.hote.querySelector('pre')!
      expect(pre.textContent).toContain('RADIAL PROFILE of 64 rays')

      zones[0]!.value = 'un robot boulanger'
      zones[0]!.dispatchEvent(new Event('input'))
      await nextTick()
      expect(pre.textContent).toContain('un robot boulanger')
    } finally {
      m.demonte()
    }
  })

  it('un JSON valide : apercu puis emission de l’avatar exact', async () => {
    const m = await monte()
    try {
      await versImporter(m)
      await colle(m, ETOILE)

      // aucun diagnostic, mais un apercu : la silhouette REDESSINEE en rayons
      expect(m.hote.querySelector('ul')).toBeNull()
      const chemin = m.hote.querySelector<SVGElement>('svg path')!
      expect(chemin.getAttribute('d')!.startsWith('M')).toBe(true)
      expect(chemin.getAttribute('d')).toContain('C')

      boutonAjouter(m).click()
      await nextTick()
      expect(m.importes).toHaveLength(1)
      expect(m.importes[0]!.id).toBe('perso-star')
      expect(m.importes[0]!.name).toBe('Star')
      expect(m.importes[0]!.radii).toHaveLength(PROFILE_SAMPLES)
      // l'avatar emis est CE que l'import direct produit : le parent n'a
      // aucune decision geometrique a prendre
      expect(m.importes[0]).toEqual(importerAvatar(ETOILE).avatar)
    } finally {
      m.demonte()
    }
  })

  it('un JSON refuse : diagnostics traduits et prompt de reparation', async () => {
    const m = await monte()
    try {
      await versImporter(m)
      await colle(m, '{"version":2}')

      const items = [...m.hote.querySelectorAll('ul li')].map((li) => li.textContent)
      const attendus = importerAvatar('{"version":2}').diagnostics.map((d) =>
        messageDiagnostic(langue.value, d)
      )
      expect(items.length).toBeGreaterThan(0)
      expect(items).toEqual(attendus)

      const reparations = [...m.hote.querySelectorAll('pre')].map((p) => p.textContent)
      expect(reparations.join('\n')).toContain('Reply with ONLY the corrected JSON')
      // pas de bouton d'ajout quand l'import echoue, mais le texte d'excuse
      expect(m.hote.textContent).not.toContain(texte(langue.value, 'ajouter'))
    } finally {
      m.demonte()
    }
  })

  it('le bouton de fermeture emet close, sans rien importer', async () => {
    const m = await monte()
    try {
      m.hote.querySelector<HTMLButtonElement>('button')!.click()
      await nextTick()
      expect(m.fermetures()).toBe(1)
      expect(m.importes).toHaveLength(0)
    } finally {
      m.demonte()
    }
  })
})
