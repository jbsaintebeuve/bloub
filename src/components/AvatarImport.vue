<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import type { ImportedAvatar } from '@/bot/avatar-import'
import { importerAvatar, MAX_TEXTE } from '@/bot/avatar-import'
import { promptGeneration, promptReparation } from '@/bot/avatar-import-prompt'
import { closedPath, toPoints, type Silhouette } from '@/bot/shape'
import { langue } from '@/i18n'
import { messageDiagnostic, texte, type TextesIu } from './AvatarImportTextes'

/**
 * * Parcours « Generer / Importer » en BOITE MODALE : le parent monte ce
 * composant conditionnellement (v-if sur son bouton d'ajout) et lui laisse
 * tout le reste. Ce composant ne touche NI au stockage NI a la selection :
 * il emet `import` avec l'avatar valide, `close` quand on le quitte, et le
 * parent tranche (persistance dans `bloub:formes`, selection de la forme,
 * fermeture).
 *
 * La racine est un `<dialog>` ouvert en modal a l'insertion : le navigateur
 * apporte alors le piege a focus, la fermeture par Echap (evenement `cancel`
 * puis `close`, branche ci-dessous), le retour du focus au declencheur et
 * l'inertie du reste de la page — le meme contrat que `GifDialog` et
 * `ConfirmDialog` (`useModalDialog`), ecrit ici parce que le parent monte sur
 * un `v-if` : la boite s'ouvre a l'insertion, pas sur un changement de booleen.
 *
 * Aucun appel de modele ici : l'agent de conversation est EXTERNE, passe par
 * un prompt copie. Le texte colle ne franchit jamais le DOM autrement qu'en
 * nombres (rayons) ou par l'interpolation de Vue (nom) : pas d'injection SVG.
 */

const emit = defineEmits<{ import: [avatar: ImportedAvatar]; close: [] }>()

const boite = useTemplateRef<HTMLDialogElement>('boite')

onMounted(() => {
  const dialog = boite.value
  if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
})

// le composant peut disparaitre alors que la boite est ouverte (changement de
// vue) : une `<dialog>` laissee en modal bloquerait la page entiere
onBeforeUnmount(() => {
  if (boite.value?.open) boite.value.close()
})

const onglet = ref<'generer' | 'importer'>('generer')
/** La description survit au changement d'onglet : le prompt de reparation la reprend. */
const description = ref('')
const colle = ref('')
const erreurFichier = ref(false)
let lecture = 0

async function chargeFichier(fichier?: File) {
  if (!fichier) return
  const version = ++lecture
  const avant = colle.value
  erreurFichier.value = false
  try {
    if (fichier.size > MAX_TEXTE) throw new Error('Fichier trop volumineux')
    const nouveau = await fichier.text()
    if (version === lecture && colle.value === avant) colle.value = nouveau
  } catch {
    if (version === lecture) erreurFichier.value = true
  }
}

function choisitFichier(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  void chargeFichier(event.target.files?.[0])
  event.target.value = ''
}

const t = (cle: keyof TextesIu) => texte(langue.value, cle)

const prompt = computed(() => promptGeneration(description.value))
const rapport = computed(() => (colle.value.trim() ? importerAvatar(colle.value) : null))
const avatar = computed(() => rapport.value?.avatar ?? null)
const messages = computed(() =>
  (rapport.value?.diagnostics ?? []).map((d) => messageDiagnostic(langue.value, d))
)
const reparation = computed(() => {
  const diags = rapport.value?.diagnostics
  if (!diags?.length) return ''
  return promptReparation(description.value, colle.value.trim(), diags.map((d) => d.en))
})

/**
 * Apercu : la silhouette REDESSINEE depuis les 64 rayons seulement. C'est
 * exactement ce que Bloub affichera — pas le contour du JSON d'origine, que
 * l'import jette. Centree sur (50, 50) d'une boite 0 0 100 100.
 */
const cheminApercu = computed(() => {
  const radii = avatar.value?.radii
  if (!radii) return ''
  const silhouette: Silhouette = { radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
  const points = toPoints(silhouette, 36).map((p) => ({ x: p.x + 50, y: p.y + 50 }))
  return closedPath(points)
})

/* --------------------------------------------------------------- copie */

const copieOk = ref<'generer' | 'reparation' | null>(null)
let minuterie: ReturnType<typeof setTimeout> | null = null

/**
 * Copie vers le presse-papiers, avec repli texte pour les contextes non
 * securises (navigator.clipboard indisponible en HTTP). Le temoin « Copie »
 * retombe seul ; si une copie relance pendant l'attente, l'ancienne minuterie
 * est jettee — c'est la derniere copie qui compte.
 */
async function copie(contenu: string, cible: 'generer' | 'reparation') {
  let ok = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(contenu)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok) {
    const zone = document.createElement('textarea')
    zone.value = contenu
    zone.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(zone)
    zone.select()
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    zone.remove()
  }
  if (ok) {
    copieOk.value = cible
    if (minuterie) clearTimeout(minuterie)
    minuterie = setTimeout(() => {
      copieOk.value = null
      minuterie = null
    }, 1500)
  }
}

onUnmounted(() => {
  if (minuterie) clearTimeout(minuterie)
})

/** Boutons pilules du personnalisateur, pour la coherence visuelle. */
const BOUTON_PRINCIPAL =
  'h-8 cursor-pointer rounded-lg bg-[var(--ink)] px-3 text-xs text-[var(--paper)] transition hover:opacity-90 active:scale-95'
const BOUTON_ONGLET =
  'h-8 cursor-pointer rounded-lg px-3 text-xs transition bg-black/5 hover:bg-black/10 aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]'
</script>

<template>
  <!--
    `.dialogue` porte l'animation d'ouverture et le fond assombri (styles.css).
    Espace de travail : 32rem au plus, jamais plus large que la fenetre moins
    2rem (lisible sur un telephone de 375 px), et 85dvh au plus — au-dela c'est
    le CONTENU de la boite qui defile, pas la page derriere. `m-auto` centre la
    boite modale (le reset Tailwind tuerait le centrage natif).

    `@close` couvre toutes les fermetures : le bouton ✕ emet `close` (le parent
    demonte alors le composant), et Echap ferme nativement la boite, ce qui
    declenche cet evenement.
  -->
  <dialog
    ref="boite"
    class="dialogue m-auto w-[min(32rem,calc(100vw_-_2rem))] max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 text-[var(--ink)] shadow-xl"
    :aria-label="t('titre')"
    @close="emit('close')"
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ t('titre') }}</h3>
      <button
        type="button"
        class="h-7 w-7 cursor-pointer rounded-lg text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]"
        :aria-label="t('fermer')"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <!-- Deux onglets, mais SANS role=tablist : le contrat clavier des onglets
         n'est pas tenu ici, et le role le promettrait. Ce sont juste deux
         boutons a bascule, comme les popups du rail. L'onglet actif prend le
         focus a l'ouverture de la boite. -->
    <div class="mt-2 flex gap-2">
      <button
        type="button"
        :class="BOUTON_ONGLET"
        :aria-pressed="onglet === 'generer'"
        :autofocus="onglet === 'generer'"
        @click="onglet = 'generer'"
      >
        {{ t('ongletGenerer') }}
      </button>
      <button
        type="button"
        :class="BOUTON_ONGLET"
        :aria-pressed="onglet === 'importer'"
        :autofocus="onglet === 'importer'"
        @click="onglet = 'importer'"
      >
        {{ t('ongletImporter') }}
      </button>
    </div>

    <div v-if="onglet === 'generer'" class="mt-3 flex flex-col gap-3">
      <p class="text-xs text-[var(--muted)]">{{ t('generationIntro') }}</p>
      <label class="flex flex-col gap-1.5 text-xs text-[var(--muted)]">
        {{ t('descriptionLabel') }}
        <textarea
          v-model="description"
          class="h-14 resize-none rounded-lg bg-black/5 p-2.5 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
          maxlength="400"
          rows="2"
          :placeholder="t('descriptionPlaceholder')"
        />
      </label>
      <pre class="max-h-44 overflow-auto rounded-lg bg-black/5 p-2.5 text-[11px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap">{{ prompt }}</pre>
      <div class="flex flex-wrap items-center gap-2">
        <button :class="BOUTON_PRINCIPAL" type="button" @click="copie(prompt, 'generer')">
          {{ copieOk === 'generer' ? t('copie') : t('copier') }}
        </button>
        <span class="text-xs text-[var(--muted)]">{{ t('generationLangue') }}</span>
      </div>
    </div>

    <div
      v-else
      class="mt-3 flex flex-col gap-3"
      @dragover.prevent
      @drop.prevent="chargeFichier($event.dataTransfer?.files[0])"
    >
      <p class="text-xs text-[var(--muted)]">{{ t('importIntro') }}</p>
      <textarea
        v-model="colle"
        class="h-24 resize-y rounded-lg bg-black/5 p-2.5 font-mono text-xs text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
        :aria-label="t('ongletImporter')"
        :maxlength="MAX_TEXTE"
        :placeholder="t('collePlaceholder')"
      />

      <label class="w-fit cursor-pointer text-xs underline focus-within:outline">
        {{ t('choisirFichier') }}
        <input type="file" accept=".json,application/json" class="sr-only" @change="choisitFichier" />
      </label>
      <p v-if="erreurFichier" role="alert" class="text-xs text-[var(--danger)]">
        {{ t('erreurFichier') }}
      </p>

      <template v-if="messages.length">
        <div>
          <p class="text-xs font-semibold text-[var(--danger)]">{{ t('diagnosticsIntro') }}</p>
          <ul class="mt-1 list-disc pl-5 text-xs text-[var(--danger)]">
            <li v-for="(message, i) in messages" :key="i">{{ message }}</li>
          </ul>
        </div>
        <p class="text-xs text-[var(--muted)]">{{ t('reparationIntro') }}</p>
        <pre class="max-h-40 overflow-auto rounded-lg bg-black/5 p-2.5 text-[11px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap">{{ reparation }}</pre>
        <button :class="BOUTON_PRINCIPAL" type="button" @click="copie(reparation, 'reparation')">
          {{ copieOk === 'reparation' ? t('copie') : t('copierReparation') }}
        </button>
      </template>

      <template v-else-if="avatar">
        <p class="text-xs text-[var(--muted)]">{{ t('valide') }}</p>
        <svg viewBox="0 0 100 100" class="h-24 w-24 self-center" role="img" :aria-label="t('apercu')">
          <path :d="cheminApercu" fill="var(--ink)" />
        </svg>
        <button :class="[BOUTON_PRINCIPAL, 'self-end']" type="button" @click="emit('import', avatar)">
          {{ t('ajouter') }}
        </button>
      </template>
    </div>
  </dialog>
</template>
