/**
 * ЛАБОРАТОРИЯ · FIELD·5 — реестр демо и категории.
 *
 * Порядок массива = порядок приборов на полке (L·01…L·10).
 */

import type { DemoCategory, DemoModule } from '@/lib/lab/types'
import { flowFieldDemo } from './flowField'
import { curlNoiseDemo } from './curlNoise'
import { sdfDemo } from './sdfPlayground'
import { ditherDemo } from './dither'
import { feedbackDemo } from './feedback'
import { textParticlesDemo } from './textParticles'
import { lgardenDemo } from './lgarden'
import { verletRopeDemo } from './verletRope'
import { oscilloscopeDemo } from './oscilloscope'
import { halftoneDemo } from './halftone'

export const DEMOS: DemoModule[] = [
  flowFieldDemo,
  curlNoiseDemo,
  sdfDemo,
  ditherDemo,
  feedbackDemo,
  textParticlesDemo,
  lgardenDemo,
  verletRopeDemo,
  oscilloscopeDemo,
  halftoneDemo,
]

/** Метаданные категорий для фильтров и чипов карточек. */
export const CATEGORY_META: Record<DemoCategory, { label: string; color: string }> = {
  fields: { label: 'Поля', color: '#e84fd0' },
  shaders: { label: 'Шейдеры', color: '#e8b34d' },
  physics: { label: 'Физика', color: '#4ef08a' },
  gen: { label: 'Генерация', color: '#ece7dd' },
}

/** Фильтры лаборатории: «Все» + четыре категории. */
export const FILTERS: { id: 'all' | DemoCategory; label: string; color?: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'fields', label: 'Поля', color: CATEGORY_META.fields.color },
  { id: 'shaders', label: 'Шейдеры', color: CATEGORY_META.shaders.color },
  { id: 'physics', label: 'Физика', color: CATEGORY_META.physics.color },
  { id: 'gen', label: 'Генерация', color: CATEGORY_META.gen.color },
]
