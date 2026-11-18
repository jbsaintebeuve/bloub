<script setup lang="ts">
import { computed } from 'vue'
import BotTile from '@/components/BotTile.vue'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { t } from '@/i18n'

const shape = defineModel<string>('shape', { required: true })
const color = defineModel<string>('color', { required: true })
const expression = defineModel<string>('expression', { required: true })
/** Teinte libre en #RRGGBB : possedee par l'app, qui la stocke et la valide. */
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
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold">{{ t('panel.shape') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="s in SHAPES"
        :key="s.id"
        :label="t(`shapes.${s.id}`)"
        :selected="s.id === shape"
        :shape="s.id"
        :color="color"
        :color-hex="couleurVignettes"
        :expression="expression"
        :frozen-at="PREVIEW_AT"
        @click="shape = s.id"
      />
    </div>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.expression') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="e in EXPRESSIONS"
        :key="e.id"
        :label="t(`expressions.${e.id}`)"
        :selected="e.id === expression"
        :shape="shape"
        :color="color"
        :color-hex="couleurVignettes"
        :expression="e.id"
        :frozen-at="PREVIEW_AT"
        @click="expression = e.id"
      />
    </div>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.color') }}</h2>
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
        Teinte libre : la pastille montre la couleur courante, et l'input natif
        `type="color"` la couvre entierement en transparent — c'est lui qui prend
        le clic ET le clavier. Choisir une teinte selectionne `perso` en meme
        temps qu'il ecrit la valeur, les deux modeles partent ensemble.
      -->
      <div
        class="relative flex aspect-square items-center justify-center rounded-full border-2 transition"
        :class="
          color === 'perso' ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
        "
      >
        <span
          class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
          :style="{ background: couleurPerso }"
        />
        <input
          type="color"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          :value="couleurPerso"
          :aria-label="t('colors.perso')"
          @input="couleurPerso = ($event.target as HTMLInputElement).value; color = 'perso'"
        />
      </div>
    </div>
  </div>
</template>
