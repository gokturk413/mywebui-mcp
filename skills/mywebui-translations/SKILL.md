---
name: mywebui-translations
description: Use when a mywebui screen, custom control, npm widget, report or 3D scene must show text in several languages (az, en, ru, de, tr, …) - <t-t>, IOB.t, local_language, translations.json, a control's translations field, webui-translations.json, switching the language; or when a text shows its key instead of the translation or does not change on a language switch.
---

# mywebui translations

A key is a dot-path (`alarm.ackbtn`). It is resolved nearest scope first, each scope falling back
`current language → en → any language`, and finally to the key itself (a visible "missing" hint).

```
control's own "translations"  →  npm widget's webui-translations.json (+ project override)
→  project data/translations.json  →  the key
```

`global:` skips the chain: `global:alarm.ackbtn` is always the project dictionary.

## Use

| Where | Write |
|---|---|
| HTML (screen or template) | `<t-t>alarm.ackbtn</t-t>`: the whole text content is the key; live on switch |
| control / widget script | `IOB.t('title', instance)` (scoped) · `IOB.t('alarm.ackbtn')` (project) |
| binding (reactive) | `bind-content:text="local_language;window.IOB.t('alarm.ackbtn')"` |
| 3D scene | object names, `t:key` property values, `t(key)` in the scene script |
| report | all of the above; a file is made in one language |

Re-render script-made text on a switch:

```js
instance.__offLang = IOB.languageChanged.on(lang => render(instance));   // init
instance.__offLang?.dispose();                                              // disconnectedCallback
// or: window.addEventListener('languageChanged', e => …)  — e.detail is the code ('az')
```

## Storage

```jsonc
// <project>/data/translations.json  (nested groups)
{ "az": { "alarm": { "ackbtn": "Təsdiqlə" } }, "en": { "alarm": { "ackbtn": "Acknowledge" } } }
// a .control file
{ "html": "…", "translations": { "az": { "title": "Səviyyə" }, "en": { "title": "Level" } } }
// npm package root: webui-translations.json
{ "tags": ["acme-level"], "prefix": "acme-", "translations": { "en": { "title": "Level" } } }
```

Programmatic: `IOB.translations`, `await IOB.saveTranslations()`, `IOB.translationsChanged.on(…)`,
`IOB.widgetTranslations`, `IOB.getWidgetTranslationsForTag(tag)`, `await IOB.saveWidgetTranslationsOverride(o)`.

## Language

`IOB.language` (current), `IOB.setLanguage('en')` (persists `localStorage['webui-language']`, sets
`<html lang>`, fires `languageChanged`, syncs `local_language`). Start: localStorage → ioBroker
`system.config.common.language` → `en`. Selector controls: `Language/LanguageSelector`, `LanguageSelector2`.
Built-in runtime texts (`writeFeedback.*`, `readQuality.*`, `quality.*`, `diag.*`, `confirmWrite.*`,
`access.*`, `startScreen.*`) are overridden by the same key in the project dictionary.

## Common mistakes

| Mistake | Fix |
|---|---|
| `<t-t>Level: </t-t>` / text mixed into `<t-t>` | `<span><t-t>level</t-t>: …</span>` |
| `IOB.t('title')` inside a control | `IOB.t('title', instance)`, else the control's own dictionary is skipped |
| text built once in `init` | re-render on `languageChanged` |
| `e.detail.name` on `languageChanged` | `e.detail` is the code itself (unlike `webui-theme-changed`) |
| only one language | at least `en`; new controls are seeded with az/en/ru/de/tr |

Full guide: `docs/translations.md`, `docs/translations-api.md`.
