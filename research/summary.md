# SUMMARY — сводка разведки

Сводка, к которой я возвращался при каждом ключевом решении. Подробности: `references.md` (референсы), `tech-notes.md` (технологии), `docs/ARCHITECTURE.md` (решения).

## 10–12 ключевых выводов для пяти экспериментов

1. **Рендер-ядро — WebGL2 + three.js r186 (24.09, релиз подтверждён). WebGPU не строить как основу**: Firefox 160 и Safari — за флагами/частично, только secure context. Прогрессивное улучшение — как у Bruno Simon (TSL, выбор рендерера, фолбек). *[подтверждено: caniuse, MDN, bruno-simon.com]*

2. **Интеграция с Next 16**: `next/dynamic` c `ssr:false` легален **только внутри Client Component** (в Server — ошибка); `loading:` — наш boot-состояние. Все canvas/WebGL/Audio — в `useEffect`, полный teardown (у `Object3D` в r186 появился `dispose()` — вызывать `super.dispose()`). *[подтверждено: nextjs.org/docs, Migration Guide 185→186]*

3. **Raymarching (ЭКСП. 01)**: брать точные SDF IQ (sphere/box/roundBox/torus…), приёмы — domain repetition, smooth min, soft shadows, SDF bounding volumes (акселерация), better fog, multires AO. **Сниппеты IQ — MIT**. ACES-тонмаппинг и dithering — стандартная практика three.js (не из сырья). *[подтверждено: iquilezles.org/articles/distfunctions + индекс 144 статей]*

4. **Генеративный звук (ЭКСП. 02)**: OscillatorNode (sine/square/sawtooth + PeriodicWave), планирование через AudioParam-методы (`setValueAtTime` имеет приоритет над `.value`); реверб — синтетический IR в ConvolverNode (equal-power normalize); аудиореактив — AnalyserNode (`fftSize`, `smoothingTimeConstant`, `getByteFrequencyData`; работает без подключения выхода). Лимита одновременных звуков нет (1000+). *[подтверждено: MDN]*

5. **Autoplay-политика — критична для ЭКСП. 02/05**: AudioContext создавать/resume строго в user gesture; `state === 'suspended' → resume()`; звук всегда с PLAY/MUTE-тумблером (у Lusion, Resn, Bruno — так). ARIA `role="switch"`. *[подтверждено: MDN Best practices + три студийных сайта]*

6. **Физика глифов (ЭКСП. 04)**: свой движок по модели Matter.js — broad-phase AABB → узкая фаза, restitution, **sleeping** (порог энергии) + статические тела. Glyph atlas + verlet — стандарт, в сырье не подтверждён (проверить на прототипе). *[подтверждено: matter.js; верле — заключение]*

7. **Персистентность (ЭКСП. 05)**: паттерн Bruno Simon «whispers» — сообщения посетителей: максимум 30 (новые вытесняют старые), одно на пользователя, 30 символов, элегантная деградация при офлайн-сервере («Server currently offline»). Прямой образец для API/Prisma-организма. *[подтверждено: bruno-simon.com]*

8. **Тренд-канон иммерсивного веба (Awwwards SOTY 2017–2025)**: Lusion v3 (2023), Bruno Simon (2019), KPR/Resn (2022), Igloo Inc/abeto и Opal Tadpole (2024), Lando Norris/OFF+BRAND и Messenger/abeto (2025). Победы 2026-ленты — микрокоманды и сольные сайты (Chladni · A Geometry of Sound; The state of the gallery; /zeroz; The Watch). **Жанр «лаборатория» котируется.** *[подтверждено: awwwards.com]*

9. **Композиционные паттерны топ-сайтов**: скролл-дирижёр («CONTINUE TO SCROLL» у Lusion); редакционная типографика поверх WebGL (Obys); физическая песочница с геймпадом и достижениями (Bruno); оконно-игровая навигация (Resn: drag/drop, fullscreen, rotate). *[подтверждено по контенту страниц]*

10. **Свежие API — использовать выборочно**: OffscreenCanvas — Baseline high (рендер в Worker; в three.js manual есть готовый раздел); View Transitions (одно-документные) — Baseline low c 14.10.2025 (`document.startViewTransition()`) — годятся для хаб-переходов; CSS scroll-driven animations (`animation-timeline: scroll()/view()`) — Chrome да, в MDN помечена «not Baseline» → только как enhancement; **WebXR — недоступен (флаги в Firefox/Safari)** — не планировать как функцию. *[подтверждено: caniuse + MDN]*

11. **Ресурсы для реализации**: three.js manual (разделы Post Processing, Fog, dispose/Freeing Resources, OffscreenCanvas, WebGPU); постобработка — `three/examples/jsm` (EffectComposer) для WebGL; для TSL-пассов r186 справочник имён в Migration Guide (BloomNode, GTAONode, pixelationPass…). *[подтверждено: threejs.org/manual, Migration Guide]*

12. **Риски/ограничения**: IQ-страницы rm/curl/noise отдают 404 (смотреть зеркала/Shadertoy-плейлисты IQ); Shadertoy закрыт Cloudflare-щитом (контент не снят); bjornstar.com и httpster.io при чтении вернули чужие сайты (в расчёт не брать); WebGPU-compute и кросс-документные View Transitions — caniuse-данные не извлеклись (не полагаться); поиск по многим запросам дал шум — все факты выше проверены только по указанным источникам. *[подтверждено фактами чтения]*

## Что это значит по экспериментам (кратко)

- **01 МОНОЛИТ**: GLSL SDF-реймарч по IQ + bounding volumes для перфа; fog/AO из арсенала IQ; DPR-кап 2, resize-обработка.
- **02 СИНТЕЗ**: нативный Web Audio (без tone.js), синтез + синтетический реверб + AnalyserNode; вход в звук только по жесту пользователя; референс-идея — Chladni.
- **03 АРХИВ**: three.js сцены, «гравитация внимания» = целевая камера/затухание; референсы — Resn (окна), Lusion (скролл-сцены), The state of the gallery.
- **04 ТЕКСТОВОЕ ПОЛЕ**: собственный верле-движок glyph-atlas'а со sleeping; типографическая культура Obys.
- **05 ОРГАНИЗМ**: персистентность по образцу whispers (лимиты + деградация) поверх `/api/organism` + Prisma.
