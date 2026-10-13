# Архитектура «ПОЛЕ ОПЫТОВ»

## Ключевое решение: один маршрут, семь миров

Осознанное самоограничение: весь проект живёт на единственном маршруте `/`
(src/app/page.tsx). Поэтому это не мультисайтинг, а **оболочка с полноэкранными сценами**:

- `page.tsx` — клиентский компонент: `useHashRoute` (src/lib/router.ts) разбирает `#/<slug>`;
  сцены подключены через `next/dynamic({ ssr: false })` — каждая сборка грузится по требованию,
  WebGL/Audio инициализируются только в браузере.
- Контракт вида: `export default function XSite({ onExit }: { onExit: () => void })`,
  монтируется в `fixed inset-0 z-40`. Обязанности сцены: exit-кнопка, boot-состояние,
  инфо-оверлей, prefers-reduced-motion, WebGL-фолбэк, resize+DPR-кап, полный teardown
  (RAF/слушатели/ResizeObserver/AudioContext.close()/WEBGL_lose_context).
- Телеметрия: при смене маршрута `page.tsx` шлёт `POST /api/telemetry` — хаб и отчёт
  показывают живые счётчики.

## Потоки данных

- **Телеметрия** (`/api/telemetry`): POST `{site}` → запись `Visit`; GET → groupBy по сценам.
  Rate-limit 60/мин (src/lib/rate-limit.ts, скользящее окно в памяти).
- **Организм** (`/api/organism`): GET — singleton-состояние + последние 200 мутаций;
  POST `{type:'graft'|'pulse', angle, distance, potency, visitorId, clientEnergy}` — сервер
  клампит все значения, лимит 30/мин, generation = 1 + totalGrafts/12. Клиент (сцена organism)
  поллит раз в 5 c, мутации применяются оптимистично, рост детерминирован
  (mulberry32(mutation.id)) — любой клиент рендерит одинаковое существо из одной истории.
- **Prisma/SQLite**: модели `Organism` (singleton), `Mutation`, `Visit` (prisma/schema.prisma).

## Устройство сцен

### monolith
`renderer.ts` — класс-владелец: канвас, компиляция шейдеров из `shaders.ts` (GLSL ES 3.00),
uniform-кэш, камера (скролл-аккумулятор с ограничением скорости, параллакс взгляда, покачивание),
светоч-курсор с инерцией, логика сигил/восхождения, динамическое разрешение по EMA времени
кадра. `world.ts` — константы мира, синхронизированные с GLSL. DOM-слой: HUD, оверлеи.

### synthesis
`audio/engine.ts` — планировщик (lookahead 0.12 c / тик 25 мс), гармонический цикл
(Am–F–C–G по 8 тактов), голоса семян (два расстроенных saw + LP-LFO; евклид-треугольник;
формантный хор; мембрана), граф: голос → StereoPanner → [dry + Convolver(процедурный IR)]
→ компрессор → AnalyserNode → destination. `render/` — фон WebGL2 (uniform-ы от FFT)
и Canvas-сад (L-ветви, пульс от событий нот). Вход только по жесту (autoplay policy).

### archive
`engine.ts` (three r186): сцена с FogExp2, тёплый свет, ACESFilmic; машина состояний
дрейф→притяжение→полёт→орбита; райкаст «гравитации внимания» (камера ускоряется к объекту
под курсором после 0.6 c зависания). `sculptures.ts` — 9 генераторов BufferGeometry по seed
(параметры карточек экспонатов читаются из реальных переменных генерации). Полный dispose
геометрий/материалов/рендерера при выходе.

### textfield
`physics.ts` — импульсный солвер (broad-сетка, AABB-пары, позиционная релаксация, сон),
`verlet.ts` — дистанционные связи с разрывом; `atlas.ts` — кэш глифов (char,size,color)
в offscreen-канвасы; размеры тел из measureText. Акты — подсцены с общей физикой.

### organism
`api.ts` — клиент API; `energy.ts` — сессионная энергия внимания; `growth.ts` —
детерминированное дерево ветвей из мутаций; `renderer.ts` — Canvas 2D со свечением-спрайтами.
Зрелость интерфейса (виньетка, плотность планктона, лоадер) зависит от поколения.

## Библиотека (src/lib/lab)

Контракт `DemoModule` (types.ts): метаданные + параметры (range/toggle/select) +
`create(canvas, params, {reduced}) → { frame, setParam, destroy, pointer? }`.
`useDemoLoop` — RAF с автопаузой по видимости и reduced-motion;
`math.ts` — mulberry32/hash/valueNoise2D(+fbm)/изинги; `glkit.ts` — WebGL2-минимум
(полноэкранный треугольник из gl_VertexID, компиляция программ, uniform-кэш).

## Находки, стоящие знаний

- **TypeScript 5.9**: null-сужение `const` после раннего return НЕ сохраняется в hoisted
  function-декларациях (замыкания). Паттерн `const ctx0 = ...; if (!ctx0) return; const ctx = ctx0`
  — надёжен (см. src/sites/lab/demos/*).
- **Turbopack**: `export interface` в .ts с параметром-иниализатором в сигнатуре метода
  интерфейса (`resize(maxDim = 4096)`) ломает сборку всей клиентской графы (ошибка выглядит
  как «Parsing ecmascript source code failed» на `export interface`) — в интерфейсах только
  `maxDim?: number`.
- **Web Audio autoplay**: контекст создаётся строго по жесту; гейт «Войти в сад» — единственная
  точка создания. Teardown — `stop планировщика → disconnect → close()`.
- **Персистентность без регистрации**: анонимная метка «гость #xxxx» из localStorage + серверные
  клампы и rate-limit — спам дороже, чем вклад в организм.
