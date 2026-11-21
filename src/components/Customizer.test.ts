// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createApp, h } from 'vue'
import { t } from '@/i18n'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import Customizer from './Customizer.vue'

/**
 * Le panneau monte comme App.vue le monte : cinq modeles en entree, rien en
 * sortie — on observe les `onUpdate:*` pour verifier que les choix continuent
 * de remonter (ils sont ecrits dans le stockage par App.vue, hors du composant).
 *
 * Couvre l'ergonomie du panneau : navigation a onglets (un seul groupe rendu,
 * contrat clavier du radiogroup), action Ajouter hors de la grille dans
 * l'en-tete epingle et sa boite modale, onglet Couleurs avec palette du corps
 * et yeux distinctes et retour au defaut des yeux toujours present.
 */

function monte() {
  const etat = reactive({
    shape: 'cercle',
    color: 'encre',
    expression: 'neutre',
    couleurYeux: '',
    couleurPerso: '#6366f1'
  })
  const app = createApp({
    render: () =>
      h(Customizer, {
        shape: etat.shape,
        'onUpdate:shape': (v: string) => (etat.shape = v),
        color: etat.color,
        'onUpdate:color': (v: string) => (etat.color = v),
        expression: etat.expression,
        'onUpdate:expression': (v: string) => (etat.expression = v),
        couleurYeux: etat.couleurYeux,
        'onUpdate:couleurYeux': (v: string) => (etat.couleurYeux = v),
        couleurPerso: etat.couleurPerso,
        'onUpdate:couleurPerso': (v: string) => (etat.couleurPerso = v)
      })
  })
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  app.mount(hote)
  return { hote, etat, demonte: () => app.unmount() }
}

const radios = (hote: HTMLElement) => [...hote.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
const sections = (hote: HTMLElement) => [...hote.querySelectorAll<HTMLElement>('section')]
const enTete = (hote: HTMLElement) => hote.querySelector<HTMLElement>('.sticky')!

async function cliqueOnglet(hote: HTMLElement, index: number) {
  radios(hote)[index]!.click()
  await nextTick()
}

describe('Customizer', () => {
  it('la navigation a trois onglets et un seul groupe est rendu a la fois', async () => {
    const m = monte()
    try {
      expect(m.hote.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
        t('panel.navSections')
      )
      expect(radios(m.hote)).toHaveLength(3)
      // roving tabindex : seul l'onglet actif est dans l'ordre de tabulation
      expect(radios(m.hote).map((r) => r.tabIndex)).toEqual([0, -1, -1])
      expect(radios(m.hote).map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])

      // Formes par defaut : la grille seule, sans le bouton + (passe dans l'en-tete)
      expect(sections(m.hote)).toHaveLength(1)
      expect(sections(m.hote)[0]!.getAttribute('aria-label')).toBe(t('panel.shape'))
      expect(sections(m.hote)[0]!.querySelectorAll('button')).toHaveLength(SHAPES.length)

      await cliqueOnglet(m.hote, 1)
      expect(sections(m.hote)).toHaveLength(1)
      expect(sections(m.hote)[0]!.getAttribute('aria-label')).toBe(t('panel.expression'))
      expect(sections(m.hote)[0]!.querySelectorAll('button')).toHaveLength(EXPRESSIONS.length)
      expect(radios(m.hote).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
      expect(radios(m.hote).map((r) => r.tabIndex)).toEqual([-1, 0, -1])

      await cliqueOnglet(m.hote, 2)
      expect(sections(m.hote)).toHaveLength(1)
      expect(sections(m.hote)[0]!.getAttribute('aria-label')).toBe(t('panel.color'))
    } finally {
      m.demonte()
    }
  })

  it('les fleches du radiogroup changent d’onglet et le focus suit le choix', async () => {
    const m = monte()
    try {
      const avant = radios(m.hote)[0]!
      avant.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
      await nextTick()
      expect(radios(m.hote).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
      expect(document.activeElement).toBe(radios(m.hote)[1])

      // on tourne en rond : fleche gauche depuis le premier onglet revient au dernier
      radios(m.hote)[0]!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
      )
      await nextTick()
      expect(radios(m.hote).map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true'])
      expect(document.activeElement).toBe(radios(m.hote)[2])
    } finally {
      m.demonte()
    }
  })

  it('Ajouter est dans l’en-tête épinglé, hors de la grille, et ouvre la boîte modale', async () => {
    const m = monte()
    try {
      const bouton = [...enTete(m.hote).querySelectorAll('button')].find((b) =>
        b.textContent?.includes(t('panel.addShape'))
      )!
      expect(bouton).toBeTruthy()
      // hors de la grille : l'action ne defile pas avec les vignettes
      expect(sections(m.hote)[0]!.contains(bouton)).toBe(false)

      bouton.click()
      await vi.waitFor(() => expect(m.hote.querySelector('dialog')).toBeTruthy(), { timeout: 3000 })
      const boite = m.hote.querySelector<HTMLDialogElement>('dialog')!
      // ouverte en modal : Echap, piege a focus et retour du focus natifs
      expect(boite.open).toBe(true)
      expect(boite.className).toContain('dialogue')
      // le parcours Générer/Importer est dedans
      await vi.waitFor(() => expect(boite.querySelector('textarea')).toBeTruthy(), { timeout: 3000 })

      // fermeture (Echap ferme nativement puis declenche `close`) : le parent demonte
      boite.dispatchEvent(new Event('close'))
      await nextTick()
      expect(m.hote.querySelector('dialog')).toBeNull()
    } finally {
      m.demonte()
    }
  })

  it('onglet Couleurs : palette du corps et yeux distinctes, reset des yeux toujours présent', async () => {
    const m = monte()
    try {
      await cliqueOnglet(m.hote, 2)
      const section = sections(m.hote)[0]!

      // deux blocs etiquetes distincts : corps, puis yeux apres un filet
      const titres = [...section.querySelectorAll('h3')].map((h) => h.textContent)
      expect(titres).toEqual([t('panel.bodyColor'), t('panel.eyeColor')])

      // palette du corps : 12 presets + la teinte libre
      const palette = section.querySelector<HTMLElement>('.grid-cols-6')!
      expect(palette.querySelectorAll('button')).toHaveLength(COLORS.length)

      // pastille des yeux : meme famille que les pastilles du corps, et son
      // champ color reste hors du Tab et de l'arbre d'accessibilite
      const yeux = [...section.querySelectorAll('h3')].find((h) => h.textContent === t('panel.eyeColor'))!
        .parentElement!
      const pastille = yeux.querySelector<HTMLButtonElement>('button[aria-pressed]')!
      expect(pastille.getAttribute('aria-label')).toBe(t('panel.eyeColor'))
      expect(pastille.getAttribute('aria-pressed')).toBe('false')
      const champ = yeux.querySelector<HTMLInputElement>('input[type="color"]')!
      expect(champ.tabIndex).toBe(-1)
      expect(champ.getAttribute('aria-hidden')).toBe('true')

      // le retour au defaut est TOUJOURS la, desactive tant qu'aucune teinte n'est choisie
      const reset = [...yeux.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(t('panel.resetEyeColor'))
      )!
      expect(reset.disabled).toBe(true)

      m.etat.couleurYeux = '#112233'
      await nextTick()
      expect(reset.disabled).toBe(false)
      expect(pastille.getAttribute('aria-pressed')).toBe('true')
      expect(champ.value).toBe('#112233')

      reset.click()
      await nextTick()
      expect(m.etat.couleurYeux).toBe('')
      expect(reset.disabled).toBe(true)
    } finally {
      m.demonte()
    }
  })

  it('choisir une forme ou une expression remonte bien par les modeles', async () => {
    const m = monte()
    try {
      sections(m.hote)[0]!.querySelectorAll('button')[3]!.click()
      await nextTick()
      expect(m.etat.shape).toBe(SHAPES[3]!.id)

      await cliqueOnglet(m.hote, 1)
      sections(m.hote)[0]!.querySelectorAll('button')[5]!.click()
      await nextTick()
      expect(m.etat.expression).toBe(EXPRESSIONS[5]!.id)
    } finally {
      m.demonte()
    }
  })
})
