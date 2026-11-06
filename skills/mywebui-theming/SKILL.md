---
name: mywebui-theming
description: Use when styling a mywebui custom control, npm widget, screen or report so it follows the runtime theme (dark, light, purple, teal, contrast, glass, user themes), creating a theme (Global Style, Theme Creator, marketplace theme), or when colours stay dark in the light theme, a theme switch leaves a control on the old colour, or SVG colours ignore the theme.
---

# mywebui theming

A theme is one CSS rule on `<html>`: `html[data-webui-theme="name"]{color-scheme:…; --ui-*:…}`.
The variables inherit into every shadow root, so a control only has to read them.

## Tokens

| Token | For | Token | For |
|---|---|---|---|
| `--ui-page` | page background (runtime's job) | `--ui-text` | primary text |
| `--ui-surface` | panel, card | `--ui-dim` | secondary text |
| `--ui-surface-2` | track, raised part | `--accent` | selection, focus, links |
| `--ui-input` | input background | `--ui-ok` / `--ui-warn` / `--ui-error` / `--ui-info` | status |
| `--ui-border` | borders, ticks | `--ui-backdrop` | glass blur, only the glass theme sets it |

Dark fallbacks: page `#1a1f2b`, text `#e2e6ec`, dim `#9aa3b0`, surface `#252b38`, surface-2 `#2f3545`,
input `#3a3f4b`, border `#3b4250`, accent `#2680eb`, ok `#37d67a`, warn `#f6b73c`, error `#ef4d5e`, info `#2b8bff`.

## Rules

1. Always `var(--token, <dark fallback>)`: `background:var(--ui-surface,#252b38)`.
2. Status colours through `--ui-ok/warn/error/info`.
3. SVG presentation attributes do not take `var()`: `style="fill:var(--ui-text,#fff)"` or a class.
4. Tints: `color-mix(in srgb, var(--accent,#2680eb) 22%, transparent)`, not new colours.
5. Glass: `backdrop-filter:var(--ui-backdrop,none)` on the main surface only.
6. No CSS `transition` on token-driven `color` / `background` / `border-color` (Chromium freezes it in
   shadow roots on a theme flip); transition `opacity` / `transform` instead.
7. No `prefers-color-scheme` in a control: light is just another theme.
8. Canvas / JS colours: read `getComputedStyle(document.documentElement).getPropertyValue('--ui-text')`
   and redraw on `webui-theme-changed` (remove the listener in `disconnectedCallback`).

## API

```js
window.mywebuiTheme.apply('light');   // switch, persist (localStorage 'webui-theme'), fire the event
window.mywebuiTheme.current();        // 'dark' when nothing is stored
window.mywebuiTheme.list();           // [{name, label}], built-ins + every [data-webui-theme] rule found
window.addEventListener('webui-theme-changed', e => e.detail.name);   // detail is an object
```

Script functions: `IOB.api.setTheme({theme})`; Simple Script *Set theme*.

## Making a theme

```css
html[data-webui-theme="forest"]{color-scheme:dark;--ui-page:#0b1e12;--ui-text:#e2f5e9;--ui-dim:#93b8a1;
--ui-surface:#12301d;--ui-surface-2:#1a4029;--ui-input:#1f4c31;--ui-border:#2a5c3c;--accent:#34d399;
--ui-ok:#34d399;--ui-warn:#e8c35a;--ui-error:#ff7a7a;--ui-info:#4cc3ff;}
```

- Put it in Designer → Global → **Global Style**; the theme selector finds it.
- For the marketplace or the developer bridge: exactly this one rule, only `color-scheme`, `--ui-*`,
  `--accent`; no comments, `url()`, `@`, `\`, `<`; name of lower-case letters, digits, `-`; not a
  built-in name. Marketplace themes are kept in `market-themes.json` (Global or project).
- Reports: Page → Theme `paper` (default, light tokens on white), `runtime`, or a theme name.

Full guide: `docs/theming.md`.
