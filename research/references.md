# REFERENCES — Референсы современного иммерсивного веба

Конспект разведки по прочитанным страницам (сайты студий, ленты Awwwards, MDN, caniuse).
Снимок данных: сент.–окт. 2026 (caniuse: Chrome 157 / Edge 154 / Firefox 160 / iOS Safari 27.2).

Пометки:
- **[подтверждено]** — факт взят напрямую из источника (страница студии, список Awwwards, MDN/caniuse).
- **[предположение]** — общее знание индустрии, НЕ подтверждённое источником (проверять при необходимости).

---

## РАЗБОРЫ КЛЮЧЕВЫХ РЕФЕРЕНСОВ

### 1. Lusion — lusion.co (студия, Бристоль, UK)
Приз: **SOTY 2023 «Lusion v3»** **[подтверждено — список Sites of the Year на awwwards.com]**
- **Идея.** «3D visual storytelling»: бренд-медитативные миры, где повествование ведёт сам скролл. Тексты с сайта: «Bold Ideas, Brought to Life», «Step into a new world and let your imagination run wild». **[подтверждено — текст главной lusion.co]**
- **Чем выделяется.** Позиционирование через ремёсло: «We do not chase trends or produce work that looks like everyone else». Отдельная R&D-ветка labs.lusion.co. **[подтверждено]**
- **Композиция и типографика.** Крупные манифест-заголовки, рубленые на смысловые строки («Let’s work / together!»), длинные скролл-разделы с повторами «CONTINUE TO SCROLL» — ленты-подсказок, что контент бесконечен. **[подтверждено по тексту; детали шрифтовики — предположение]**
- **Анимация.** Скролл-нарратив: каждая секция появляется как новая сцена; Play Reel как отдельная глава. **[подтверждено структура; конкретные easing-приёмы — предположение]**
- **Интерактив.** Кнопки PLAY / MUTE прямо в DOM — звук как полноправная часть опыта. **[подтверждено]**
- **Технологии.** WebGL + custom GLSL, физические инсталляции, VR/AR — со слов сооснователя Edan Kwan (LinkedIn: «cutting-edge web technologies and physical interactions», «WebGL with custom GLSL»). **[подтверждено частично — по сниппету LinkedIn]**
- **Проекты (из списка на главной):** Oryzo AI, Atlas Motion, Devin AI, Of The Oak, Everswap, Porsche: Dream Machine, Synthetic Human, Meta: Spatial Fusion, Spaace, DDD 2024, Choo Choo World, Soda Experience. **[подтверждено]**
- **Что переосмыслить.** Для ЭКСП. 02/03: скролл как дирижёр сцены; звук-тумблер в явном DOM; манифест-типографика поверх WebGL.

### 2. Bruno Simon — bruno-simon.com (портфолио-плейграунд)
Приз: **SOTY 2019 «Bruno Simon Portfolio»** **[подтверждено — список SOTY]**
- **Идея.** Портфолио = физическая песочница: «Please drive around to learn more about me and discover the many secrets of this world. And don’t break anything!» **[подтверждено — текст сайта]**
- **Чем выделяется.** Самый документированный иммерсивный сайт: раздел «Behind the scene» прямо на сайте перечисляет стек.
- **Композиция и типографика.** 3D-мир вместо страницы; типографика живёт на объектах и в оверлеях управления (Options). **[подтверждено структурно]**
- **Анимация.** Физика везде: машина, прыжки (SPACE), буст (SHIFT), гидравлика (NUM KEYS — машина танцует). **[подтверждено — легенда управления]**
- **Интерактив.** Три класса ввода: клавиатура/мышь, тач, **геймпад** (джойстики, LB/RB). Достижения с таймерами (2h 30min), «I’m stuck!»-респавн, переключатель качества (Low) и Renderer. **[подтверждено]**
- **Социальный слой — «Whispers»**: сообщения посетителей; все видят; максимум 30, новое вытесняет старое; одно на пользователя; 30 символов. Плюс серверный лидерборд Circuit («Server currently offline. Scores can’t be saved» — изящный деградейшн). **[подтверждено — прямые правила со страницы]**
- **Технологии.** Three.js (mr.doob); **TSL** от Sunag — «enabling the use of both WebGL and WebGPU»; выбор рендерера WebGPU с фолбэком; исходники на GitHub под MIT (включая Blender-файлы), музыка Kounine под CC0. **[подтверждено — «Behind the scene»]**
- **Что переосмыслить.** Прямой референс для ЭКСП. 05 «ОРГАНИЗМ» (whispers = персистентный социальный слой с лимитами и деградацией) и для ЭКСП. 03 (навигация в 3D как вождение).

### 3. Active Theory — activetheory.net (студия, Венеция/СФ)
Приз: **SOTY 2018 «Active Theory v4»**; также в SOTY-списке их «Prometheus Fuels» **[подтверждено — список SOTY]**
- **Идея.** «Creative Digital Experiences» — студия знаковых иммерсивных кампаний. **[подтверждено — тайтл сайта]**
- **Чем выделяется.** Сайт целиком требует JS («Please enable javascript» — статического контента нет вообще). **[подтверждено]**
- **Композиция/типографика/анимация/интерактив.** Разобрать не удалось — контент рендерится скриптом. По общеизвестному: полноэкранные WebGL-сцены, мультиплеер-инсталляции, фреймворк Dreamwave. **[предположение]**
- **Что переосмыслить.** Урок по отказоустойчивости: полностью «мертвый» сайт без JS — нам нужно наоборот, boot-состояние и деградация (см. контракт сцен в docs/ARCHITECTURE.md).

### 4. Obys Agency — obys.agency (студия, Женева)
- **Идея.** Дизайн-студия с редакционной, шрифт-центричной подачей. **[подтверждён список работ]**
- **Портфолио (со страницы):** Makhno, Source Unknown, Autex, Odin’s Crow, Olga Prudka, Yulia, The Ways We Work (Miro), Design Education Series, Obys’ Design Books, Eminente, Abetka, BlackSheep, Salience Labs, **AI Modernism of Kharkiv**, Glyphic Biotechnologies, Porsche Taycan, Ayocin (Atmos Lamp), Grids, Peter Lindbergh. Теги: Creative Direction / Web Design-Dev / Identity — часто «Concept, Web Design/Dev, Identity». **[подтверждено]**
- **Чем выделяется.** Культура side-проектов: «Obys’ Design Books», «Abetka» (образовательные, Identity) — студия как издательство. **[подтверждено теги]**
- **Типографика/анимация.** Специфика не снята (страница отдала только список); по общеизвестному — контрастные гарнитуры, кинетика в заголовках. **[предположение]**
- **Что переосмыслить.** Для ЭКСП. 04 «ТЕКСТОВОЕ ПОЛЕ»: типографика как главный носитель идентичности; «книжность» (books, abetka) как метафора интерфейса.

### 5. Resn — resn.co.nz (студия, Веллингтон/Амстердам)
Призы: **SOTY 2022 «KPR»**, SOTY 2020 «Pioneer — Corn Revolutionized» **[подтверждено — список SOTY]**
- **Идея.** «Bringing your story to life» — play-студия. **[подтверждено — профиль на awwwards.com/resn]**
- **Интерактив.** Из имён ассетов страницы: drag-arrows, drop, fullscreen, rotate, play — драг-н-дроп контента, полноэкранность, шоу-рил, отдельный аудио-тумблер («Audio»), Close Project/Close All Projects — оконная логика. **[подтверждено — иконки/лейблы со страницы]**
- **Технологии.** Awwwards-профиль студии помечен тегами «WebGL sites», «React Websites». **[подтверждено]**
- **Что переосмыслить.** Оконно-игровая навигация для ЭКСП. 03: галерея как стопка «карточек-окон» с драгом.

### 6. Панорама Sites of the Year (Awwwards) — главный индикатор трендов
Источник: страница Awwwards «Sites Of The Year» **[подтверждено]**. Свежие обладатели:
- **SOTY 2025:** Lando Norris (OFF+BRAND) — сайт гонщика F1; Messenger (abeto).
- **SOTY 2024:** Igloo Inc (abeto); Don’t Board Me (The First The Last); Opal Tadpole (Claudio Guglieri).
- **SOTY 2023:** Lusion v3; Noomo Agency; Mana Yerba Mate (Louis Paquet).
- **SOTY 2022:** KPR (Resn); The Other Side of Truth (The First The Last); Persepolis Reimagined (Monks).
- **SOTY 2021:** Pangram Pangram Foundry (Locomotive); Star Atlas (Hello Monday); Umami Land (Monks).
- **SOTY 2020:** Kode Sports Club (Merci Michel); Dark: Official Netflix Guide (Monks); Pioneer (Resn).
- **SOTY 2019:** Bruno Simon Portfolio; Nomadic Tribe (makemepulse).
- **SOTY 2018:** Active Theory v4; Orano (Immersive Garden); Frans Hals Museum (Build in Amsterdam).
- **SOTY 2017:** Simply Chocolate (Spring/Summer); OUIGO (Merci Michel); In Pieces (BryBry).
**Чем это ценно:** подтверждённый канон студий-эталонов (Merci Michel, Monks, abeto, The First The Last, Locomotive, Hello Monday, Immersive Garden, Build in Amsterdam, makemepulse) — на них стоит равняться в постановке планки качества.

### 7. Свежая лента Awwwards (SOTD/HM, авг.–сен. 2026) — «что побеждает прямо сейчас»
Источник: лента номинантов/победителей **[подтверждено]**:
- **The Tie-break** (Merci Michel) — SOTD 25.09.2026.
- **The Tuscan Journey Begins** (MONOGRID) — SOTD 13.09.2026.
- **The state of the gallery** (Majo Puterka) — SOTD 22.08.2026 — судя по названию, рефлексия самой идеи галереи (наш ЭКСП. 03).
- **/zeroz Brand Site** (SHIFTBRAIN) — SOTD 24.08.2026.
- **The Watch** (60fps) — SOTD 17.08.2026, Product Honors.
- **20 Years Inspired by People** (/nk.studio) — SOTD 07.08.2026.
- **Chladni · A Geometry of Sound** (georgi-draganov) — номинант годовой премии: **фигуры Хладни, геометрия звука — прямой идейный референс для ЭКСП. 02 «СИНТЕЗ»** (визуализация звуковых колебаний).
- **App State Department of Art** (Mark Nystrom) — персональный сайт художника-генеративщика.
- **Jamie McKaye — The Instrument / The Shape of Intelligence** — персональные сайты одного автора в годовой номинации.
- Также: The Culture Index (Locomotive), The Cartier Roadster (Decimal), The Soviet Flip, Written in the Stars (KTStudio), TBWA\HAKUHODO (SHIFTBRAIN), The Robot and Me (Hagara Ben).
**Вывод-тренд:** среди победителей много персональных/лабораторных проектов малыми командами — «поле опытов» одиночек котируется наравне со студиями. **[заключение на основе подтверждённого списка]**

### 8. Codrops — tympanus.net/codrops
**[подтверждено — главная]**: «Fueling web creativity since 2009»; разделы: **Webzibition** — витрина 2000+ отобранных сайтов; **Case Studies** — разборы идей/дизайна/крафта; **Tutorials**; курсы сообщества (в т.ч. «Master GSAP Web Animation» Карла Шоффа, 300+ уроков); Creative Spotlights и Studio Stories — интервью студий.
**Роль для нас:** главный источник готовых приёмов (Grid/дисторшн/шейдер-эффекты) и кейсов для отчёта и лаборатории. GSAP — фактический стандарт таймлайна в индустрии. **[заключение]**

---

## КОРОТКИЙ СПИСОК (контекст и вторая линия)

| # | Референс | Что взять | Статус данных |
|---|----------|-----------|----------------|
| 9 | Awwwards (awwwards.com) | Лента SOTD/SOTM/SOTY, теги технологий (WebGL/React), годовые номинации | [подтверждено] |
| 10 | Godly (godly.design) | Кураторская галерея best web/app/ui «published on the internet» | [подтверждено — сниппет] |
| 11 | Inigo Quilez — iquilezles.org | Канон SDF/raymarching-статей: 144 статьи, код под MIT | [подтверждено — индекс статей] |
| 12 | Shadertoy (shadertoy.com) | Сообщество raymarching-шейдеров, плейлисты IQ; при чтении блокируется Cloudflare | [подтверждён факт блокировки; содержание — предположение] |
| 13 | Matter.js (matter.js) | Эталон 2D-физики: тела, composite, restitution, сон, события — референс для собственного движка глифов | [подтверждено] |
| 14 | Merci Michel (merci-michel.com) | SOTY 2017/2020 + SOTD 2026; игровой веб (Kode, OUIGO, Tie-break) | [подтверждено призами] |
| 15 | Monks (Monks/MediaMonks) | SOTY 2020/2021/2022: Dark Netflix Guide, Umami Land, Persepolis — массовый кинематографичный веб | [подтверждено призами] |
| 16 | abeto / The First The Last / Locomotive / Hello Monday / Immersive Garden / Build in Amsterdam / makemepulse | Пул студий-эталонов из списка SOTY | [подтверждено призами] |
| 17 | Majo Puterka, georgi-draganov, Jamie McKaye, Mark Nystrom, SHIFTBRAIN, MONOGRID, 60fps | Лицо «новой волны» 2026: сольные/микро-студийные иммерсивные сайты | [подтверждено лентой] |
| 18 | HTTPster (httpster.io) | Кураторская галерея независимого дизайна | [НЕ подтверждено — чтение вернуло чужой персональный блог] |
| 19 | Studio Freight | Известны Lenis smooth scroll и дарк-эстетика | [НЕ подтверждено — поиск вернул шум; Lenis — предположение] |
| 20 | Akella (akella.co) | Известный three.js-креативщик; сайт сейчас минималистичен (Wix, «Say hi») | [подтверждён текущий вид сайта; эксперименты — предположение] |

**Проверить руками при необходимости:** bjornstar.com оказался блогом разработчика расширений (не Bjorn Staal — вероятно, опечатка домена, настоящий — bjornstaal.com); sosofa.net — страница не снята. Оба — вне подтверждённой базы.

---

## СКВОЗНЫЕ ПАТТЕРНЫ (для наших пяти экспериментов)

1. **Скролл = дирижёр.** Lusion: «CONTINUE TO SCROLL» как повторяющийся мотив; прогресс-нарратив. **[подтверждено]**
2. **Звук — с тумблером в DOM.** PLAY/MUTE у Lusion, Audio у Resn и Bruno. **[подтверждено]**
3. **Физика как исследование.** Bruno: управление, прыжки, разрушение, секреты. **[подтверждено]**
4. **Социальный слой с ограничениями.** Bruno whispers: 30 штук, 1 на пользователя, 30 символов; деградация при офлайн-сервере. **[подтверждено]**
5. **Редакционная типографика поверх технологий.** Obys и весь SOTY-канон. **[подтверждено списками]**
6. **Лабораторность как жанр.** labs.lusion.co; персональные SOTD-победы; Codrops-кейс-стадии. **[подтверждено]**
7. **Звуковые геометрии.** Chladni (A Geometry of Sound) в годовой номинации — звук-форма синестезия. **[подтверждено названием/фактом номинации]**
8. **WebGPU уже у продакшн-портфолио**, но с WebGL-фолбеком через TSL. **[подтверждено — Bruno Simon]**
