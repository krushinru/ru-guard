# 🛡️ ru-guard.js

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-7c3aed?style=flat-square" alt="version"/>
  <img src="https://img.shields.io/badge/license-MIT-7c3aed?style=flat-square" alt="license"/>
  <img src="https://img.shields.io/badge/dependencies-0-7c3aed?style=flat-square" alt="zero dependencies"/>
  <img src="https://img.shields.io/badge/size-~3kb-7c3aed?style=flat-square" alt="size"/>
</p>

<p align="center">
  <b>RU</b> · <a href="#english">EN</a>
</p>

---

Лёгкая библиотека без зависимостей, которая определяет пользователей из России и управляет видимостью контента — скрывает, размывает или помечает блоки региональными сообщениями, помогая соблюдать российское законодательство. Один файл, ноль зависимостей.

```html
<!-- Авто-режим, нулевая конфигурация -->
<script src="ru-guard.js" data-auto></script>
```

---

## Содержание

- [Как это работает](#как-это-работает)
- [Быстрый старт](#быстрый-старт)
- [CSS-классы](#css-классы)
- [Конфигурация](#конфигурация)
- [Публичное API](#публичное-api)
- [Точность детектирования](#точность-детектирования)
- [Собственный IP API](#собственный-ip-api)
- [Поддержка браузеров](#поддержка-браузеров)
- [Лицензия](#лицензия)

---

## Как это работает

```
Пользователь заходит на сайт
        │
        ▼
Запрос к ipapi.co (IP-геолокация)
        │
   ┌────┴────┐
успех      ошибка
   │           │
   ▼           ▼
Страна      Запрос к ip-api.com (резерв)
по IP           │
   │       ┌────┴────┐
   │    успех      ошибка
   │       │           │
   │       ▼           ▼
   │    Страна      Timezone
   │    по IP       по Intl API
   │       │           │
   └───────┴───────────┘
                │
                ▼
     Применяем режим детектирования:
     'ip|timezone'  → IP или TZ совпал
     'ip+timezone'  → IP и TZ совпали
     'ip'           → только IP
     'timezone'     → только TZ
                │
          ┌─────┴─────┐
       Россия      Не Россия
          │             │
          ▼             ▼
     ru-hide        ru-only → скрыть
     ru-censor      ru-only-alert → оверлей
     ru-censor-alert
     ru-censor-words
```

Если оба IP API недоступны — детектирование корректно переключается на часовой пояс. Библиотека покрывает все 20 российских IANA-зон от Калининграда до Анадыря.

---

## Быстрый старт

### Авто-режим

```html
<script src="ru-guard.js" data-auto></script>
```

Атрибут `data-auto` запускает `RuGuard.init()` автоматически сразу после загрузки скрипта.

### Ручная инициализация

```html
<script src="ru-guard.js"></script>
<script>
  RuGuard.init({
    detection:     'ip|timezone',
    censoredWords: ['VPN', 'впн', 'Tor', 'прокси'],
    alertText:     'Материал заблокирован на территории РФ',
  }).then(function(result) {
    console.log(result.isRu); // true / false
  });
</script>
```

### CommonJS / AMD

```js
const RuGuard = require('./ru-guard.js');
RuGuard.init().then(console.log);
```

---

## CSS-классы

Добавьте нужные классы к HTML-элементам — библиотека обработает их автоматически.

### Для пользователей из России

| Класс | Эффект |
|---|---|
| `ru-hide` | `display: none` — элемент полностью скрыт |
| `ru-censor` | `filter: blur(30px)` + выделение текста заблокировано |
| `ru-censor-alert` | То же размытие + тёмный оверлей «🚫 Материал заблокирован на территории РФ» |
| `ru-censor-words` | Каждое запрещённое слово в тексте блока оборачивается в размытый `<span>` |

### Для пользователей не из России

| Класс | Эффект |
|---|---|
| `ru-only` | `display: none` — элемент скрыт от всех за пределами России |
| `ru-only-alert` | Янтарный оверлей «⚠️ Этот материал предназначен только для аудитории из России» |

### Примеры разметки

```html
<!-- Скрыть ссылку на обход блокировок от российских пользователей -->
<a href="/unblock" class="ru-hide">Как получить доступ к сайту →</a>

<!-- Показать баннер только посетителям из России -->
<div class="ru-only">
  Вы просматриваете международную версию сайта.
</div>

<!-- Размыть текст для россиян без сообщения -->
<article class="ru-censor">
  Пользователи из России увидят, что здесь есть текст, но не смогут прочесть его содержание
</article>

<!-- Размыть с явным оверлеем "заблокировано" -->
<section class="ru-censor-alert">
  Пользователи из России увидят, что здесь есть текст, но вместо него увидят предупреждение
</section>

<!-- Предупредить не-российских посетителей о региональном контенте -->
<div class="ru-only-alert">
  Инструкция по оформлению налогового вычета через Госуслуги.
</div>

<!-- Размыть только конкретные слова прямо в тексте -->
<p class="ru-censor-words">
  Многие используют VPN для доступа к заблокированным сайтам.
  Слово «впн» обрабатывается аналогично.
</p>
```

---

## Конфигурация

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `detection` | `string` | `'ip\|timezone'` | Режим детектирования (см. ниже) |
| `ipApiUrl` | `string` | `'https://ipapi.co/json/'` | Основной IP API. Должен возвращать JSON с полем `country_code` |
| `ipApiFallbackUrl` | `string` | `'https://ip-api.com/json/'` | Резервный IP API |
| `ipTimeout` | `number` | `4000` | Таймаут каждого запроса в мс |
| `censoredWords` | `string[]` | `['VPN', 'впн', 'ВПН']` | Слова для размытия в блоках `.ru-censor-words`. Поиск без учёта регистра |
| `blurAmount` | `string` | `'30px'` | Радиус CSS-размытия |
| `alertText` | `string` | `'Материал заблокирован на территории РФ'` | Текст оверлея для `.ru-censor-alert` |
| `nonRuAlertText` | `string` | `'Этот материал предназначен только для аудитории из России'` | Текст оверлея для `.ru-only-alert` |

### Режимы детектирования

| Режим | Описание |
|---|---|
| `'ip\|timezone'` | РФ, если совпал IP **или** TZ. Максимальный охват *(по умолчанию)* |
| `'ip+timezone'` | РФ, только если совпали IP **и** TZ. Минимум ложных срабатываний |
| `'ip'` | Только IP. При недоступности обоих API — fallback на TZ |
| `'timezone'` | Только TZ. Синхронно, без сети, работает мгновенно |

---

## Публичное API

### `RuGuard.init(config?)` → `Promise<result>`

Ждёт `DOMContentLoaded`, затем запускает детектирование и применяет правила к DOM. Безопасно вызывать в любой момент.

### `RuGuard.run(config?)` → `Promise<result>`

Запускается немедленно. Используйте, если нужно самостоятельно контролировать момент запуска (DOM должен быть готов).

### `RuGuard.isRussianUser(config?)` → `Promise<boolean>`

Только детектирование, без изменений DOM. Удобно для аналитики и кастомной логики:

```js
RuGuard.isRussianUser().then(function(isRu) {
  if (isRu) analytics.track('ru_visitor');
});
```

### Объект результата

Все три метода возвращают промис с одинаковой структурой:

```js
{
  // Детектирование
  isRu:    true,           // итоговое решение
  method:  'ip|timezone',  // использованный режим
  tzMatch: true,           // совпал ли часовой пояс
  ipMatch: true,           // совпал ли IP (null — оба API недоступны)

  // Применённые изменения DOM
  hidden:       1,  // .ru-hide скрытых
  censored:     1,  // .ru-censor размытых
  alerts:       1,  // .ru-censor-alert с оверлеем
  wordBlocks:   1,  // .ru-censor-words обработанных
  ruOnly:       0,  // .ru-only скрытых (для не-РФ)
  ruOnlyAlerts: 0,  // .ru-only-alert с оверлеем (для не-РФ)
}
```

---

## Точность детектирования

| Сигнал | Плюсы | Минусы |
|---|---|---|
| **IP** | Точно, пользователь не может подменить без VPN | Требует сетевого запроса; лимиты у бесплатных API |
| **Timezone** | Мгновенно, без сети | Русскоязычные эмигранты за рубежом могут иметь российский TZ |
| **`ip+timezone`** | Минимум ложных срабатываний | Может пропустить VPN-пользователей с российским TZ |
| **`ip\|timezone`** | Максимальный охват | Выше вероятность ложных срабатываний |

Режим `'timezone'` — правильный выбор, если нужен полностью автономный скрипт без каких-либо внешних запросов.

---

## Собственный IP API

Стандартные эндпоинты (`ipapi.co` и `ip-api.com`) бесплатны, но имеют лимиты. Для продакшена рассмотрите:

- **Кэширование** — сохраняйте код страны в `sessionStorage` после первого запроса, чтобы избежать повторных обращений к API.
- **Self-hosting** — разверните [ip-api](https://ip-api.com/docs/api:json) на своей инфраструктуре или используйте базу [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) с прокси.

Подойдёт любой эндпоинт, возвращающий JSON с полем `country_code` или `countryCode` (ISO 3166-1 alpha-2):

```js
RuGuard.init({
  ipApiUrl:         'https://geo.yoursite.com/api/me',
  ipApiFallbackUrl: 'https://ipapi.co/json/', // оставьте публичный резерв
});
```

---

## Поддержка браузеров

Работает во всех современных браузерах. Требует `fetch` и `Promise` (нативно с Chrome 42 / Firefox 40 / Safari 10.1). Для IE11 добавьте полифиллы перед подключением библиотеки.

---

## Лицензия

MIT © 2026

---

<a name="english"></a>

<p align="center">
  <a href="#">RU</a> · <b>EN</b>
</p>

---

A lightweight, dependency-free JavaScript library that detects Russian users and controls content visibility — hiding, blurring, or annotating blocks with region-specific messages. One file, zero dependencies.

```html
<!-- Zero-config auto mode -->
<script src="ru-guard.js" data-auto></script>
```

---

## Table of Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [CSS classes](#css-classes)
- [Configuration](#configuration)
- [Public API](#public-api)
- [Detection accuracy](#detection-accuracy)
- [Hosting your own IP API](#hosting-your-own-ip-api)
- [Browser support](#browser-support)
- [License](#license-1)

---

## How it works

```
User visits the site
        │
        ▼
Fetch ipapi.co (IP geolocation)
        │
   ┌────┴────┐
success    error
   │           │
   ▼           ▼
Country     Fetch ip-api.com (fallback)
by IP           │
   │       ┌────┴────┐
   │    success    error
   │       │           │
   │       ▼           ▼
   │    Country     Timezone
   │    by IP       via Intl API
   │       │           │
   └───────┴───────────┘
                │
                ▼
     Apply detection mode:
     'ip|timezone'  → IP or TZ matches
     'ip+timezone'  → IP and TZ both match
     'ip'           → IP only
     'timezone'     → TZ only
                │
          ┌─────┴──────┐
       Russia       Not Russia
          │               │
          ▼               ▼
     ru-hide          ru-only → hide
     ru-censor        ru-only-alert → overlay
     ru-censor-alert
     ru-censor-words
```

If both IP APIs are unavailable, detection gracefully falls back to timezone. The library covers all 20 Russian IANA timezone zones from Kaliningrad to Anadyr.

---

## Quick start

### Auto mode

```html
<script src="ru-guard.js" data-auto></script>
```

The `data-auto` attribute triggers `RuGuard.init()` automatically as soon as the script loads.

### Manual init

```html
<script src="ru-guard.js"></script>
<script>
  RuGuard.init({
    detection:     'ip|timezone',
    censoredWords: ['VPN', 'впн', 'Tor', 'proxy'],
    alertText:     'This content is blocked in Russia',
  }).then(function(result) {
    console.log(result.isRu); // true / false
  });
</script>
```

### CommonJS / AMD

```js
const RuGuard = require('./ru-guard.js');
RuGuard.init().then(console.log);
```

---

## CSS classes

Mark your HTML elements with these classes — the library processes them automatically at runtime.

### For Russian visitors

| Class | Effect |
|---|---|
| `ru-hide` | `display: none` — element is completely hidden |
| `ru-censor` | `filter: blur(30px)` + text selection disabled |
| `ru-censor-alert` | Same blur + dark overlay "🚫 Material is blocked in Russia" |
| `ru-censor-words` | Every censored word in the block's text is individually wrapped in a blurred `<span>` |

### For non-Russian visitors

| Class | Effect |
|---|---|
| `ru-only` | `display: none` — element is hidden from everyone outside Russia |
| `ru-only-alert` | Amber overlay "⚠️ This content is intended for a Russian audience only" |

### Usage examples

```html
<!-- Hide a bypass-censorship link from Russian users -->
<a href="/unblock" class="ru-hide">How to access blocked sites →</a>

<!-- Show a banner only to visitors from Russia -->
<div class="ru-only">
  You are viewing the international version of this site.
</div>

<!-- Blur article text for Russian users, no message -->
<article class="ru-censor">
  Blur article text for Russian users, no message
</article>

<!-- Blur with an explicit "blocked" overlay -->
<section class="ru-censor-alert">
  Blur with an explicit "blocked" overlay
</section>

<!-- Warn non-Russian visitors that content is region-specific -->
<div class="ru-only-alert">
  Instructions for filing a tax deduction via Russian public services portal.
</div>

<!-- Blur only specific forbidden words inline -->
<p class="ru-censor-words">
  Many users rely on VPN services to access blocked websites.
  The word «впн» is treated the same way.
</p>
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `detection` | `string` | `'ip\|timezone'` | Detection mode (see below) |
| `ipApiUrl` | `string` | `'https://ipapi.co/json/'` | Primary IP API. Must return JSON with a `country_code` field |
| `ipApiFallbackUrl` | `string` | `'https://ip-api.com/json/'` | Fallback IP API |
| `ipTimeout` | `number` | `4000` | Timeout per request in ms |
| `censoredWords` | `string[]` | `['VPN', 'впн', 'ВПН']` | Words to blur inside `.ru-censor-words` blocks. Case-insensitive |
| `blurAmount` | `string` | `'30px'` | CSS blur radius |
| `alertText` | `string` | `'Материал заблокирован на территории РФ'` | Overlay text for `.ru-censor-alert` |
| `nonRuAlertText` | `string` | `'Этот материал предназначен только для аудитории из России'` | Overlay text for `.ru-only-alert` |

### Detection modes

| Mode | Description |
|---|---|
| `'ip\|timezone'` | Russian if IP **or** TZ matches. Broadest coverage *(default)* |
| `'ip+timezone'` | Russian only if IP **and** TZ both match. Fewest false positives |
| `'ip'` | IP only. Falls back to TZ if both APIs are unreachable |
| `'timezone'` | TZ only. Synchronous, no network, instant |

---

## Public API

### `RuGuard.init(config?)` → `Promise<result>`

Waits for `DOMContentLoaded`, then runs detection and applies all DOM rules. Safe to call at any point.

### `RuGuard.run(config?)` → `Promise<result>`

Runs immediately. Use when you need to control the timing yourself (DOM must already be ready).

### `RuGuard.isRussianUser(config?)` → `Promise<boolean>`

Detection only — no DOM changes. Use for analytics or custom logic:

```js
RuGuard.isRussianUser().then(function(isRu) {
  if (isRu) analytics.track('ru_visitor');
});
```

### Result object

All three methods resolve with the same shape:

```js
{
  // Detection
  isRu:    true,           // final verdict
  method:  'ip|timezone',  // detection mode used
  tzMatch: true,           // did the timezone match?
  ipMatch: true,           // did the IP match? (null if both APIs failed)

  // DOM changes applied
  hidden:       1,  // .ru-hide elements hidden
  censored:     1,  // .ru-censor elements blurred
  alerts:       1,  // .ru-censor-alert elements blurred + overlaid
  wordBlocks:   1,  // .ru-censor-words blocks processed
  ruOnly:       0,  // .ru-only elements hidden (non-RU visitors)
  ruOnlyAlerts: 0,  // .ru-only-alert elements overlaid (non-RU visitors)
}
```

---

## Detection accuracy

| Signal | Pros | Cons |
|---|---|---|
| **IP** | Accurate, users cannot spoof it without a VPN | Requires a network request; rate-limited free APIs |
| **Timezone** | Instant, no network | Russian-speaking expats may have a Russian TZ |
| **`ip+timezone`** | Fewest false positives | May miss VPN users who kept a Russian TZ |
| **`ip\|timezone`** | Maximum coverage | Higher chance of false positives |

The `'timezone'`-only mode is the right choice when you need a fully self-contained script with no external requests.

---

## Hosting your own IP API

The default endpoints (`ipapi.co` and `ip-api.com`) are free but rate-limited. For production consider:

- **Caching** — store the country code in `sessionStorage` after the first lookup to avoid repeat requests.
- **Self-hosting** — deploy [ip-api](https://ip-api.com/docs/api:json) or use [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) with a proxy.

Any endpoint returning JSON with a `country_code` or `countryCode` field (ISO 3166-1 alpha-2) works automatically:

```js
RuGuard.init({
  ipApiUrl:         'https://geo.yoursite.com/api/me',
  ipApiFallbackUrl: 'https://ipapi.co/json/', // keep a public fallback
});
```

---

## Browser support

Works in all modern browsers. Requires `fetch` and `Promise` (native since Chrome 42 / Firefox 40 / Safari 10.1). For IE11 support add polyfills before loading the library.

---

## License

MIT © 2026
