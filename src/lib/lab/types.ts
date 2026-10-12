/**
 * ЛАБОРАТОРИЯ · FIELD·5 — контракт микро-демо.
 *
 * Каждое демо лаборатории — автономный модуль: описывает свои параметры,
 * создаёт живой рендер на переданном canvas и полностью убирает за собой.
 * Из этих модулей выросли эксперименты проекта, поэтому API держим
 * минимальным и стабильным.
 */

/** Категория демо — определяет цвет чипа и акценты карточки. */
export type DemoCategory = 'fields' | 'shaders' | 'physics' | 'gen'

/** Значение параметра демо. */
export type ParamValue = number | boolean | string

/** Вариант для select-параметра. */
export interface ParamOption {
  value: string
  label: string
}

/**
 * Описание одного параметра демо.
 * Диапазон значений параметра задаётся разработчиком демо и не валидируется рантаймом.
 */
export interface ParamDef {
  /** Ключ, под которым значение приходит в create/setParam. */
  key: string
  /** Человекочитаемая подпись (короткая, идёт в панель прибора). */
  label: string
  kind: 'range' | 'toggle' | 'select'
  min?: number
  max?: number
  step?: number
  /** Начальное значение. */
  value: ParamValue
  /** Варианты для kind: 'select'. */
  options?: ParamOption[]
}

/** Курсор над канвасом. Координаты — в CSS-пикселях от левого верхнего угла. */
export interface DemoPointer {
  x: number
  y: number
  down: boolean
}

/** Опции создания демо. */
export interface DemoCreateOpts {
  /** Пользователь просил уменьшить движение: рисуем статичный кадр, параметры работают. */
  reduced: boolean
}

/** Живой экземпляр демо, возвращаемый из create(). */
export interface DemoInstance {
  /**
   * Слот курсора: если демо его выставляет, карточка пишет сюда позицию
   * указателя (CSS-пиксели от угла canvas) и состояние кнопки.
   * Координаты (-9999, -9999) означают «указатель вне канваса».
   */
  pointer?: DemoPointer
  /** Нарисовать кадр: t — секунды с начала цикла, dt — длительность кадра (с). */
  frame(t: number, dt: number): void
  /** Обновить один параметр на лету (без пересоздания). */
  setParam(key: string, value: ParamValue): void
  /**
   * Подгонка под новый размер (вызывается карточкой из ResizeObserver).
   * Реализация необязательна: демо может следить за размером сама.
   */
  resize?(): void
  /** Полная очистка: слушатели, WebGL-контекст, таймеры. Вызывается ровно один раз. */
  destroy(): void
}

/** Модуль демо — «прибор» лаборатории. */
export interface DemoModule {
  /** Слаг, уникальный в пределах лаборатории. */
  id: string
  /** Русское название. */
  title: string
  /** Латинское имя для приборной панели. */
  latin: string
  category: DemoCategory
  /** Одна-две фразы: что показывает демо. */
  description: string
  /** Короткая техническая строка (моно, серый): приёмы и алгоритмы. */
  tech: string
  /** Панель параметров (2–4 штуки). */
  params: ParamDef[]
  /**
   * Создать живой рендер на canvas. Контекст (2D/WebGL2) демо берёт само.
   * Возвращает экземпляр; карта параметров передаётся по значениям.
   */
  create(
    canvas: HTMLCanvasElement,
    params: Record<string, ParamValue>,
    opts: DemoCreateOpts,
  ): DemoInstance
}

/** Читает числовой параметр с защитой от неверного типа. */
export function numParam(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' ? v : fallback
}

/** Читает строковый параметр с защитой от неверного типа. */
export function strParam(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const v = params[key]
  return typeof v === 'string' ? v : fallback
}
