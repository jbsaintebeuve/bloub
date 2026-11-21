<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import type { ImportedAvatar } from '@/bot/avatar-import'
import { FORMES_IMPORTEES, LIMITE_FORMES_IMPORTEES } from '@/ui/formes-importees'
import { ecris } from '@/ui/stockage'
import BotTile from '@/components/BotTile.vue'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, DEFAULT_SHAPE, SHAPES, teinteLisible } from '@/bot/skins'
import { t } from '@/i18n'

const AvatarImport = defineAsyncComponent(() => import('./AvatarImport.vue'))

const shape = defineModel<string>('shape', { required: true })
const color = defineModel<string>('color', { required: true })
const expression = defineModel<string>('expression', { required: true })
/** Teinte libre en #RRGGBB : possedee par l'app, qui la stocke et la valide. */
const couleurYeux = defineModel<string>('couleurYeux', { required: true })
const couleurPerso = defineModel<string>('couleurPerso', { required: true })

/**
 * Les vignettes sont figees a la meme date que la pose de repos : elles montrent
 * la forme et le visage tels qu'ils apparaitront, pas un aplat abstrait.
 */
const PREVIEW_AT = 1

/** Ce que les vignettes portent : la teinte libre ne rend que si elle est choisie. */
const couleurVignettes = computed(() => (color.value === 'perso' ? couleurPerso.value : undefined))

/** Les presets seuls : la teinte libre a sa propre pastille, avec son selecteur. */
const PRESETS = COLORS.filter((c) => c.id !== 'perso')

/** Ce que la pastille montre : la teinte telle que le bot la rendra. */
const teinteRendue = computed(() => teinteLisible(couleurPerso.value))

/* ------------------------------------------------------------- navigation */

/** Les trois groupes du panneau, un seul visible a la fois. */
type Onglet = 'formes' | 'expressions' | 'couleurs'
const onglet = ref<Onglet>('formes')

/**
 * Les onglets de la navigation, en PLURIEL : un onglet nomme la section qu'il
 * ouvre, pas le choix qu'un clic pose — d'ou des cles `tab*` distinctes des
 * `panel.shape` et consorts, qui restent les etiquettes des sections.
 */
const ONGLETS = computed<Array<{ id: Onglet; label: string }>>(() => [
  { id: 'formes', label: t('panel.tabFormes') },
  { id: 'expressions', label: t('panel.tabExpressions') },
  { id: 'couleurs', label: t('panel.tabCouleurs') }
])

/**
 * Clavier du groupe : meme contrat qu'un radiogroup natif (voir Settings.vue)
 * — le role PROMET les fleches et un seul arret de tabulation, d'ou le
 * `tabindex` mobile dans le gabarit et ce gestionnaire : les fleches tournent
 * d'un onglet a l'autre et le focus suit le choix.
 */
function auClavier(event: KeyboardEvent, index: number) {
  const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!pas) return
  event.preventDefault()
  // on tourne en rond, comme un groupe de radios natif
  const cible = ONGLETS.value[(index + pas + ONGLETS.value.length) % ONGLETS.value.length]!
  onglet.value = cible.id
  // le focus suit le choix, sinon les fleches suivantes repartent de l'ancien
  const boutons = (event.currentTarget as HTMLElement).parentElement?.children
  const suivant = boutons?.[ONGLETS.value.indexOf(cible)]
  if (suivant instanceof HTMLElement) suivant.focus()
}

/* ------------------------------------------------------------------ ajout */

const ajoutOuvert = ref(false)
const formesDisponibles = computed(() => [
  ...SHAPES.map(({ id }) => ({ id, name: t(`shapes.${id}`) })),
  ...FORMES_IMPORTEES.values()
])
const limiteAtteinte = computed(() => FORMES_IMPORTEES.size >= LIMITE_FORMES_IMPORTEES)
const formeImportee = computed(() => FORMES_IMPORTEES.has(shape.value))

function ajouteForme(avatar: ImportedAvatar) {
  if (limiteAtteinte.value && !FORMES_IMPORTEES.has(avatar.id)) return
  FORMES_IMPORTEES.set(avatar.id, avatar)
  ecris('formes', JSON.stringify([...FORMES_IMPORTEES.values()]))
  shape.value = avatar.id
  ajoutOuvert.value = false
}

function retireForme() {
  if (!FORMES_IMPORTEES.delete(shape.value)) return
  ecris('formes', JSON.stringify([...FORMES_IMPORTEES.values()]))
  shape.value = DEFAULT_SHAPE
}

const selecteur = useTemplateRef<HTMLInputElement>('selecteur')

/**
 * Le clic sur la pastille SELECTIONNE la teinte libre, puis ouvre le selecteur.
 * Selectionner sur `input` seulement laissait impossible de revenir a la teinte
 * enregistree sans la modifier : refermer le selecteur sans changement n'emet rien.
 * `showPicker` peut lever (iframe tierce, navigateur ancien) : le `click` prend
 * alors le relais.
 */
function choisitPerso() {
  color.value = 'perso'
  const champ = selecteur.value
  if (!champ) return
  try {
    champ.showPicker()
  } catch {
    champ.click()
  }
}

/* ------------------------------------------------------------ couleur yeux */

/**
 * Couleur des yeux par defaut : le papier. Les yeux sont des trous dans le
 * corps, donc sans teinte choisie ils laissent voir le fond de la page.
 */
const OEIL_DEFAUT = '#f9f9f9'

/** Ce que la pastille des yeux montre : la teinte choisie, sinon le defaut. */
const teinteYeux = computed(() => couleurYeux.value || OEIL_DEFAUT)

const selecteurYeux = useTemplateRef<HTMLInputElement>('selecteurYeux')

/**
 * Meme porte que la teinte libre du corps (`choisitPerso`) : le clic sur la
 * pastille ouvre le selecteur natif, et le champ `type="color"` reste hors du
 * Tab et de l'arbre d'accessibilite — la pastille est la seule entree clavier.
 */
function choisitCouleurYeux() {
  const champ = selecteurYeux.value
  if (!champ) return
  try {
    champ.showPicker()
  } catch {
    champ.click()
  }
}
</script>

<template>
  <div>
    <!-- titre de structure : les onglets visibles jouent le role de titres,
         mais un panneau sans h2 n'est pas navigable au lecteur d'ecran -->
    <h2 class="sr-only">{{ t('rail.customize') }}</h2>

    <!--
      En-tete epingle : la navigation reste visible pendant le defilement —
      celui du panneau lui-meme sur grand ecran (la colonne de droite est en
      `overflow-y: auto`), celui de la PAGE sous 64rem, ou l'en-tete se cale
      sous la barre du rail (`max-lg:top-16` : le rail fait 64 px de haut).
      Fond opaque : sans lui, le contenu defilerait visiblement au travers.
    -->
    <div class="sticky top-0 z-10 bg-[var(--paper)] pb-2 max-lg:top-16">
      <!--
        Un radiogroup, comme le choix de langue des reglages : le role promet
        les fleches et un seul arret de tabulation, d'ou le `tabindex` mobile
        et `auClavier`. Les trois groupes se suivent en dessous, un seul
        n'est rendu a la fois.
      -->
      <div
        role="radiogroup"
        :aria-label="t('panel.navSections')"
        class="flex gap-1 rounded-xl bg-black/5 p-1"
      >
        <button
          v-for="(o, i) in ONGLETS"
          :key="o.id"
          type="button"
          role="radio"
          :aria-checked="onglet === o.id"
          :tabindex="onglet === o.id ? 0 : -1"
          class="h-8 flex-1 cursor-pointer rounded-lg px-2 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)] aria-checked:bg-[var(--ink)] aria-checked:text-[var(--paper)]"
          @keydown="auClavier($event, i)"
          @click="onglet = o.id"
        >
          {{ o.label }}
        </button>
      </div>

      <!--
        L'action Ajouter vit DANS l'en-tete epingle et pas dans la grille :
        elle est accessible des l'ouverture de l'onglet Formes, sans defiler.
      -->
      <div v-if="onglet === 'formes'" class="mt-2 flex items-center gap-2">
        <button
          type="button"
          class="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] text-sm transition hover:border-[var(--muted)] disabled:cursor-default disabled:opacity-50"
          :disabled="limiteAtteinte"
          @click="ajoutOuvert = true"
        >
          <span aria-hidden="true" class="text-base leading-none">+</span>
          {{ t('panel.addShape') }}
        </button>
        <button
          v-if="formeImportee"
          type="button"
          class="shrink-0 cursor-pointer text-xs underline"
          @click="retireForme"
        >
          {{ t('panel.removeImportedShape') }}
        </button>
      </div>
    </div>

    <!-- Formes : la grille de 4 colonnes reste contrainte par les 20rem du panneau. -->
    <section v-if="onglet === 'formes'" class="mt-2" :aria-label="t('panel.shape')">
      <div class="grid grid-cols-4 gap-1.5">
        <BotTile
          v-for="s in formesDisponibles"
          :key="s.id"
          :label="s.name"
          :selected="s.id === shape"
          :shape="s.id"
          :color="color"
          :color-hex="couleurVignettes"
          :eye-color="couleurYeux"
          :expression="expression"
          :frozen-at="PREVIEW_AT"
          @click="shape = s.id"
        />
      </div>
    </section>

    <section v-else-if="onglet === 'expressions'" class="mt-2" :aria-label="t('panel.expression')">
      <div class="grid grid-cols-4 gap-1.5">
        <BotTile
          v-for="e in EXPRESSIONS"
          :key="e.id"
          :label="t(`expressions.${e.id}`)"
          :selected="e.id === expression"
          :shape="shape"
          :color="color"
          :color-hex="couleurVignettes"
          :eye-color="couleurYeux"
          :expression="e.id"
          :frozen-at="PREVIEW_AT"
          @click="expression = e.id"
        />
      </div>
    </section>

    <section v-else class="mt-2" :aria-label="t('panel.color')">
      <h3 class="text-sm font-semibold">{{ t('panel.bodyColor') }}</h3>
      <div class="mt-2 grid grid-cols-6 gap-1.5">
        <button
          v-for="c in PRESETS"
          :key="c.id"
          type="button"
          class="flex aspect-square cursor-pointer items-center justify-center rounded-full border-2 transition"
          :class="
            c.id === color ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
          "
          :aria-label="t(`colors.${c.id}`)"
          :aria-pressed="c.id === color"
          @click="color = c.id"
        >
          <!-- liseré interne : sinon la pastille creme disparait sur fond clair -->
          <span
            class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
            :style="{ background: c.hex }"
          />
        </button>
        <!--
          Teinte libre : un vrai bouton, comme les presets — meme focus, meme
          `aria-pressed` — qui selectionne `perso` et ouvre le selecteur natif. Le
          champ `type="color"` reste hors de l'arbre d'accessibilite et du Tab :
          le bouton est la seule porte, le champ n'est que la popup. Il est pose
          sous la pastille pour que la popup s'ouvre a cote d'elle.
        -->
        <div class="relative">
          <button
            type="button"
            class="flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 transition"
            :class="
              color === 'perso' ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
            "
            :aria-label="t('colors.perso')"
            :aria-pressed="color === 'perso'"
            @click="choisitPerso"
          >
            <span
              class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
              :style="{ background: teinteRendue }"
            />
          </button>
          <input
            ref="selecteur"
            type="color"
            class="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
            tabindex="-1"
            aria-hidden="true"
            :value="couleurPerso"
            @input="couleurPerso = ($event.target as HTMLInputElement).value; color = 'perso'"
          />
        </div>
      </div>

      <!--
        Yeux : une section a part, apres un filet, pour que la palette du corps
        et celle des yeux ne se confondent pas. La pastille suit la meme famille
        que celles du corps : rond de 48 px (la taille d'une pastille de la
        grille), liseré interne, bordure pleine quand une teinte est choisie.
      -->
      <div class="mt-5 border-t border-[var(--line)] pt-4">
        <h3 class="text-sm font-semibold">{{ t('panel.eyeColor') }}</h3>
        <div class="mt-2 flex items-center gap-3">
          <div class="relative">
            <button
              type="button"
              class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 transition"
              :class="
                couleurYeux
                  ? 'border-[var(--ink)]'
                  : 'border-transparent hover:border-[var(--line)]'
              "
              :aria-label="t('panel.eyeColor')"
              :aria-pressed="!!couleurYeux"
              :title="t('panel.eyeColor')"
              @click="choisitCouleurYeux"
            >
              <span
                class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
                :style="{ background: teinteYeux }"
              />
            </button>
            <input
              ref="selecteurYeux"
              type="color"
              class="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
              tabindex="-1"
              aria-hidden="true"
              :value="teinteYeux"
              @input="couleurYeux = ($event.target as HTMLInputElement).value"
            />
          </div>
          <!--
            Toujours affiche, meme au defaut (alors desactive) : le retour a la
            couleur par defaut des yeux reste visible en permanence, pas seulement
            quand une teinte perso est active.
          -->
          <button
            type="button"
            class="cursor-pointer text-xs underline disabled:cursor-default disabled:opacity-50"
            :disabled="!couleurYeux"
            @click="couleurYeux = ''"
          >
            {{ t('panel.resetEyeColor') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Boite modale native : Echap, piege a focus, retour du focus au bouton Ajouter. -->
    <AvatarImport v-if="ajoutOuvert" @import="ajouteForme" @close="ajoutOuvert = false" />
  </div>
</template>
