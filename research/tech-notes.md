# TECH NOTES — Технологические заметки для «ПОЛЯ ОПЫТОВ»

Заметки разведки. Все факты снабжены источником (MDN, caniuse, релизы three.js, страницы студий).
Версии браузеров в caniuse-снимке: **Chrome 157, Edge 154, Firefox 160, Safari TP, iOS Safari 27.2** (снято ~окт. 2026).
Пометки: **[подт]** — подтверждено источником; **[закл]** — мой вывод, не подтверждённый напрямую источником.

---

## 1. Среда и версии

- **three.js r186** — релиз **24 сентября** (коммит 9b4a2ac), milestone 99; миграция 185→186 в wiki. **[подт — github.com/mrdoob/three.js/releases]**
- **Next.js**: доки сняты с версии **16.4.0** (страница Lazy Loading, обновлена 10.03.2026); в проекте установлен 16.1.3 — отличий по next/dynamic не ожидаем. **[подт — nextjs.org/docs]**
- Браузерный срез актуален: Chrome 157 = последняя строка caniuse-таблиц. **[подт — caniuse.com]**

## 2. Статус WebGPU — можно ли строить на нём

**[подт — MDN WebGPU_API + caniuse.com/webgpu]**

- MDN: «Limited availability», **не Baseline**; **только secure context (HTTPS)**. Преемник WebGL: D3D12/Metal/Vulkan-уровень, GPGPU-вычисления, дешевле рендер на CPU, compute-частицы, постобработка, culling/skinning на GPU.
- caniuse (последняя версия каждого браузера):
  - Chrome 157 — да; Edge 154 — да; Android Chrome 154 — да; Samsung Internet 30 — да.
  - **Firefox 160 — НЕТ** (флаг `dom.webgpu.enabled`; по умолчанию только Windows и macOS 26 Tahoe на Apple Silicon).
  - **Safari TP — частично** (флаг `WebGPU`; по умолчанию только macOS 26 Tahoe+); iOS Safari 27.2 — да.
  - Linux — зависит от драйверов.
- **WebGPU compute** — отдельная страница caniuse (данных не удалось извлечь, считаем тем же статусом или ниже). **[частично]**

**Заключение [закл]:** рендер-ядро проекта — **WebGL2** (three.js WebGLRenderer); WebGPU — только как прогрессивное улучшение (паттерн Bruno Simon: TSL, выбор рендерера, фолбек). Для пяти экспериментов WebGPU не обязателен.

## 3. three.js r186 + Next.js 16 / React 19

### Интеграция
- `next/dynamic` — обёртка над `React.lazy + Suspense`; лениво грузить можно только **Client Components**. **[подт — nextjs.org/docs «Lazy Loading»]**
- **`ssr: false` работает ТОЛЬКО внутри Client Component** — в Server Component будет ошибка («ssr: false is not allowed with next/dynamic in Server Components»). Динамический импорт тяжелых сцен делаем в `src/app/page.tsx` (он и так 'use client'). **[подт]**
- Опции `next/dynamic`: `loading: <Component/>` для boot-состояния; именованные экспорты поддерживаются. **[подт]**
- Внешние библиотеки — по требованию через `await import('lib')` в обработчике. **[подт — пример с fuse.js]**
- Server Components автоматически code-split; при динамическом импорте Server Component лениво грузятся только его Client-дети. **[подт]**

### Dispose/teardown (критично для нашего контракта видов)
- **В r186 у `Object3D` появился метод `dispose()`**; в кастомных типах обязательно вызывать `super.dispose()`. **[подт — Migration Guide 185→186, #34141]**
- В manual есть разделы «How to dispose of Objects» и «Freeing Resources» — канонический чеклист освобождения GPU-ресурсов. **[подт — threejs.org/manual, оглавление]**

### Важные изменения r184–r186 (Migration Guide) **[подт]**
- r185→186: `Source` → **`TextureSource`**; `BufferGeometryUtils.toTrianglesDrawMode()` больше не клонирует геометрию (индекс меняется in-place); `LightProbeGrid` → `LightProbeGridWebGL`; **`PCFSoftShadowMap` удалён для WebGPURenderer** (PCFShadowMap теперь и так soft); `SimplifyModifier` переписан на meshoptimizer, `modify()` теперь async; uniform `up` у Sky/SkyMesh удалён (всегда +Y); параметры DotScreenNode/RGBShiftNode принимают числа и ноды.
- r184→185: WebGPURenderer изменил premultiplied alpha — **при проблемах блендинга задать непрозрачный фон** (`Scene.background` / `renderer.setClearColor()`); прозрачный клир — только если миксуем с HTML-фоном; `TiledLighting` удалён → `ClusteredLighting`; `Matrix3.translate/scale/rotate` deprecated; `Object3D.updateWorldMatrix()` учитывает `matrixWorldNeedsUpdate` (при `matrixAutoUpdate=false` вручную выставлять флаг); TSL: `directionToColor()` → `packNormalToRGB()`, `positionLocal` не обновляет скinned-трансформы (нужен `positionGeometry`).
- **TSL (Three Shading Language)** — узловая система шейдинга, один код под WebGL и WebGPU (её Bruno Simon называет ключом к своему WebGPU-рендереру). **[подт — bruno-simon.com «Behind the scene»]**

### Постобработка
- Разделы manual: «How to use Post Processing» (WebGL) и «WebGPU / Post-Processing». **[подт — оглавление manual]**
- Состав `three/examples/jsm` (EffectComposer, RenderPass, UnrealBloomPass и т.п.) — рабочий путь для WebGL-пайплайна. **[закл — из практики; подтверждено, что manual ведёт постобработку через addons]**
- Из Migration Guide видны актуальные TSL-пасы three r186: `pixelationPass` (pixelSize теперь Number, #34543), `BloomNode` (AnamorphicNode удалён → BloomNode, #33600), `GTAONode` (новая модель дистанции, параметры distanceExponent/distanceFallOff deprecated), `SSRAPassNode` (без clearColor/clearAlpha), `SSRNode` (новый опциональный denoiser), `SSGINode` (RG11B10), `DotScreenNode`, `RGBShiftNode`. **[подт — Migration Guide]**

## 4. GLSL raymarching (по канону Inigo Quilez)

Источник: «distance functions» + индекс 144 статей iquilezles.org **[подт]**. **Код-сниппеты IQ — под MIT-лицензией** (математика/шейдер-арт — под коммерческой лицензией).

- **Точные SDF-примитивы** (статья «distance functions»): сфера `length(p)-r`; box через `abs(p)-b` c `min/max`; round box; box frame; тор; capped torus; link. IQ прямо предупреждает: в интернете масса **неточных** SDF-реализаций — у него точные (L2-норма).
- **Арсенал статей (индекс)**: Raymarching SDFs; **Smooth minimum for SDFs**; **Domain Repetition**; **Soft Shadows**; Numerical normals for SDFs; Smooth Rounded Boxes; Interior SDFs; Xor operator for SDFs; **SDF Bounding Volumes** (акселерация); Binary-search raycasting for SDFs; FBM detail in SDFs; Menger fractal; Raymarching terrains; Depth buffer with raymarching.
- **Освещение/атмосфера (индекс)**: Outdoors lighting; **Better fog**; Multires ambient occlusion; SSAO; Simple global illumination; Sphere soft shadow.
- **Шумы (индекс)**: Procedural noises; FBM; gradient/value noise derivatives; **Domain warping**; **Voronoise**; Smooth voronoi; Voronoi edges; Filterable procedurals; Band-limiting procedural textures.
- **Формула мягких теней/тумана/ACES/dithering в наших терминах**: domain repetition + soft shadow + fog + AO — подтверждены как отдельные статьи IQ; **ACES-тонмаппинг и dithering против бандинга — [закл]** (стандартная практика three.js `ACESFilmicToneMapping`; в сырых данных не встретилось — при реализации опираться на three.js API).
- **Производительность фуллскрин-реймарча**: SDF Bounding Volumes и binary-search raycasting от IQ — подтверждённые приёмы ускорения; «dynamic resolution» — **[закл]** (в сырых данных только как поисковый запрос без результата). Практика Bruno Simon — переключатель Quality (Low) и WebGPU-опция — подтверждённый паттерн. **[подт]**

## 5. Web Audio: генеративная музыка (ЭКСП. 02)

- **Web Audio API — Baseline widely available (с апреля 2021)**; аудио-граф: источники → узлы-эффекты → `BaseAudioContext.destination`; **нет лимита звуковых вызовов** (не 32/64; возможны 1000+ одновременных звуков). **[подт — MDN Web_Audio_API, Using_Web_Audio_API]**
- **OscillatorNode** **[подт — MDN]**: 4 встроенных типа волны — `sine`, `square`, `sawtooth`, `triangle` (+ `custom` через `PeriodicWave`/`setPeriodicWave`); `frequency` (AudioParam, дефолт 440 Гц), `detune` (в центах); точное планирование `start(when)` / `stop(when)`.
- **ConvolverNode (реверб)** **[подт — MDN]**: линейная свёртка с `AudioBuffer`-импульсным откликом (mono/stereo/4-канала); флаг `normalize` (equal-power). Для ЭКСП. 02: **генерировать синтетический IR** (шум с экспоненциальным затуханием) в OfflineAudioContext и скармливать ConvolverNode. **[закл — сам приём; API-поверхность подтверждена]**
- **AnalyserNode (аудиореактив)** **[подт — MDN]**: `fftSize` (размер FFT), `frequencyBinCount` (= fftSize/2), `smoothingTimeConstant`, `minDecibels/maxDecibels`, `getByteFrequencyData()` → Uint8Array; узел пропускает звук без изменений и **работает даже с неподключённым выходом** (можно анализировать вхолостую).
- **Autoplay policy** **[подт — MDN Best practices]**: контекст создавать/resume внутри user gesture; состояния `suspended/running/closed`; паттерн: `if (audioCtx.state === 'suspended') audioCtx.resume()` в обработчике клика. Для OfflineAudioContext — `startRendering()`.
- **AudioParam** **[подт — MDN Best practices]**: прямой `param.value = x` vs методы `setValueAtTime` и др. — **методы имеют приоритет**; для всего, что требует тайминга, использовать методы (schedule ahead).
- **Контроль пользователя** **[подт — MDN Best practices]**: play/pause, mute, volume (range-инпуты); доступность — ARIA `role="switch"` на кнопках звука.
- **Загрузка звуков** — 4 пути: media element, fetch+decode в буфер (точнее), MediaStream, синтез (осцилляторы/собственные буферы). **[подт]**
- **Библиотеки (MDN рекомендует)**: standardized-audio-context, howler.js, tone.js, R-audio (React). Нам достаточно нативного API. **[подт]**
- **Аудио-уроки по ссылке MDN**: Violent Theremin (терменвокс на Web Audio), HolySpaceCow (реверб), «creating your own instrument». **[подт]**

## 6. Физика текста на Canvas 2D (ЭКСП. 04)

- **Matter.js** — эталонная кубатура 2D-физики **[подт — matter.js]**: rigid/compound/composite bodies, concave & convex hulls, масса/плотность, restitution, коллизии в 3 фазы (broad/mid/narrow), стабильный стекинг, события, constraints, гравитация, **sleeping и static bodies**.
- Для собственного движка глифов взять у Matter.js: **sleeping** (энергетический порог сна), статические тела, широкая фаза (грубый AABB-тест) до узкой, restitution/friction. **[закл]**
- **Glyph atlas + verlet + пружины** — наш план; в сырых данных подтверждения нет (поиск «canvas text physics» вернул шум). Техника стандартная: растеризовать глифы в offscreen-атлас, частицы — verlet-интегрирование, связи — constraint-релаксация. **[закл]**
- Альтернатива, если свой движок буксует: портировать подход «Physics»-раздела three.js manual (для 3D) или взять принципы примеров Matter.js. **[закл]**

## 7. Процедурная генерация

- **L-системы** **[подт — Wikipedia «L-system»]**: параллельная переписывающая система/формальная грамматика (Линденмайер, 1968, Утрехт) — алфавит, продукции, аксиома + механизм трансляции строк в геометрию; самоподобие → фракталы, модели растений/бактерий. Осторожно: статья помечена шаблоном «may incorporate text from LLM» — базовые факты корректны, детали проверять по первоисточникам.
- **Superformula / gyroid** — в источниках НЕТ (поиск вернул шум); использовать как **[закл]** по общеизвестным формулам (Gielis superformula; gyroid `sin x cos y + sin y cos z + sin z cos x = 0`).
- **Curl noise / flow fields** — статьи IQ есть (в индексе есть Noise/Derivatives/Domain warping), но страницы curl-noise вернули 404; практические формулы — **[закл]**: curl шума = дивергентно-свободное поле (перекрёстные производные), идеально для «жидких» частиц. Ближайшие подтверждённые опоры: «Gradient noise derivatives», «Domain warping», «Voronoise». **[частично]**
- Генеративное/креативное кодирование как жанр — r/generative (art with autonomous systems), Generative Art International Conference. **[подт — сниппеты поиска]**

## 8. Свежие API браузеров (снимок caniuse + MDN)

| API | Статус | Детали **[подт]** |
|-----|--------|--------------------|
| **OffscreenCanvas** | Baseline **high** (low 27.03.2023, high 27.09.2025) | Канвас без DOM, рендер в **Web Worker**, transferable object; в three.js manual есть раздел «Using OffscreenCanvas in a Web Worker» |
| **CSS scroll-driven animations** (`animation-timeline`) | MDN: **limited availability**, не Baseline | `animation-timeline: scroll() \| view()`, именованные таймлайны, View Timeline ranges (entry/cover/contain/exit); Chrome c 115; анимировать **transform**, не width (композит); `animation-timeline` — НЕ часть шорта `animation`, объявлять после него |
| **View Transitions API** (одно-документная) | Baseline **low** (14.10.2025) | `document.startViewTransition()` (SPA), ViewTransition {ready, finished, skip}, типы переходов, element-scoped; кросс-документные — `@view-transition`, события `pagereveal`/`pageswap` (данные caniuse по cross-doc не извлеклись) |
| **Web Animations API** | Baseline **high** (16.03.2023) | `element.animate()`; в iOS Safari нет composite modes |
| **WebXR** | **limited** — НЕ считать доступным | Chromium — частично; Firefox/Safari — за флагами (`dom.vr.webxr.enabled`, «WebXR Device API» в экспериментальных); iOS — нет. Для ЭКСП. 03/05 — только опциональный enhancement |
| **WebAssembly 3.0** | релиз **сентябрь 2025** | 64-битное адресное пространство, exception handling, GC; для нас не требуется **[подт — сниппет Wikipedia/MDN]** |

- Мелочь для нашего UI: `prefers-reduced-motion` и дефолты доступности из MDN Best practices (ARIA switch для звука). **[подт]**

## 9. Источники

- **caniuse**: webgpu, view transitions, offscreen-canvas, web-animations-api, webxr (снимок Chrome 157 / Edge 154 / Firefox 160 / Safari).
- **MDN**: OscillatorNode, AnalyserNode, ConvolverNode, Web Audio best practices, Using Web Audio, OffscreenCanvas, View Transitions, animatie-timeline, WebXR, WebGPU.
- **three.js**: releases r186, Migration Guide 184→186, manual (Post Processing, Fog, Freeing Resources, OffscreenCanvas), страница про Next.js.
- **Студии и ленты**: lusion.co, bruno-simon.com, activetheory.net, resn.co.nz, obys.agency, akella.co, awwwards.com (SOTY/SOTD), tympanus.net/codrops, godly.design.
- **Прочее**: matter.js, iquilezles.org (distance functions + индекс статей), Wikipedia «L-system».
