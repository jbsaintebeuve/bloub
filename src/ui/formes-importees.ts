import { shallowReactive } from 'vue'
import { MAX_STOCKEES, type ImportedAvatar } from '@/bot/avatar-import'

export const LIMITE_FORMES_IMPORTEES = MAX_STOCKEES

export const FORMES_IMPORTEES = shallowReactive(new Map<string, ImportedAvatar>())
