---
name: mywebui-npm-widgets
description: Use when building, packaging, testing or publishing an npm package of custom elements (web components, Lit, BaseCustomWebComponent) for mywebui, or installing one into a project; or when a widget's properties do not show in the property grid, two-way bindings do not write back, lit is loaded twice, an element is "already defined", or a widget is a placeholder in a report.
---

# mywebui npm widgets

An npm widget is an ordinary ES-module package whose entry defines custom elements on import.
mywebui installs it into `<project>/widgets/`, builds an import map and loads it in the designer
and the runtime. Choose it over a `.control` when you need a build, a library, versions or tests.

## package.json

```json
{
  "name": "@acme/level-widgets", "version": "1.0.0", "type": "module",
  "main": "dist/index.js", "module": "dist/index.js", "exports": { ".": "./dist/index.js" },
  "peerDependencies": { "lit": "^3.0.0" }, "devDependencies": { "lit": "^3.3.0" },
  "customElements": "custom-elements.json"
}
```

- `dist/index.js` imports every element module; each calls `customElements.define()`.
- **Shared, never bundled:** `lit`, `lit-html`, `lit-element`, `@lit/reactive-element` (mywebui's
  lit 3) and `@node-projects/base-custom-webcomponent` / `@gokturk413/base-custom-webcomponent`.
  Declare them as peers; other `@lit/*` packages are normal dependencies.
- Ship `custom-elements.json` (manifest) and `webui-translations.json` at the package root.

## The element (Lit)

```js
import { LitElement, html, css } from 'lit';
export class AcmeLevel extends LitElement {
  static properties = { value: { type: Number }, unit: { type: String }, signal: { type: String } };
  static styles = css`:host{display:block;width:160px;height:60px}
    .b{background:var(--ui-surface,#252b38);color:var(--ui-text,#e2e6ec);border:1px solid var(--ui-border,#3b4250)}`;
  constructor() { super(); this.value = 0; this.unit = '%'; }
  connectedCallback() {
    super.connectedCallback();
    this._offLang = window.IOB?.languageChanged?.on(() => this.requestUpdate());
  }
  disconnectedCallback() { this._offLang?.dispose(); super.disconnectedCallback(); }
  render() {
    const title = window.IOB ? IOB.t('title', this) : 'Level';
    return html`<div class="b">${title}: ${this.value} ${this.unit}</div>`;
  }
  set(v) { this.value = v; this.dispatchEvent(new CustomEvent('value-changed', { detail: { newValue: v }, bubbles: true, composed: true })); }
}
customElements.define('acme-level', AcmeLevel);
```

- The property grid reads Lit `static properties` of type String, Number, Boolean, Date, Object.
  `Array` and custom converters are not shown.
- `@property` decorators of BaseCustomWebComponent are read too (`group`, `description`, `default`).
- Lower-case or dash-case-friendly names.
- **Two-way bindings:** the default write-back event of a Lit element is the dash-case property name
  (`value`); for other elements `<dash>-changed`. Dispatch `<dash>-changed` and tell screen authors to
  bind `=id::value-changed`, so it works either way.
- Apply **every** value you are given, also an equal one (unconfirmed writes come back that way).

## Memory

Unlike `.control` files, a widget has no safety net. Set up in `connectedCallback`, undo in
`disconnectedCallback`: `IOB.subscribeState` → `IOB.unsubscribeState`, `IOB.<event>.on` → `.dispose()`,
window/document listeners, timers, `requestAnimationFrame`, observers, chart instances, popups in
`document.body`. After an `await` in `connectedCallback` check `this.isConnected`. No module-level
`Map` keyed by element (use `WeakMap`).

## Translations: `webui-translations.json`

```json
{ "tags": ["acme-level"], "prefix": "acme-",
  "translations": { "en": { "title": "Level" }, "az": { "title": "Səviyyə" } } }
```

`IOB.t('title', this)` and `<t-t>title</t-t>` in the shadow DOM resolve here first, then in the
project. Projects override texts in `data/widget-translations.json` (kept across updates).

## Install, test, publish

| Step | How |
|---|---|
| try it without publishing | VS Code extension + developer bridge `openWidget` (mywebui-developer-bridge) |
| install from npm | Designer → Packages → Installed → right-click → **Add Package** |
| install a file | **Add Package from .tgz file…** (`npm pack` output, administrators) |
| distribute | npm, or a marketplace `.mwpkg` with `kind: "npm-widget"` and the tarball inside (mywebui-marketplace) |

## Reports

A generated report file cannot run package code: the widget becomes a labelled placeholder (the
browser viewer works). Build report-critical parts as a `.control`.

## Common mistakes

| Mistake | Fix |
|---|---|
| lit bundled into `dist` | external + peer dependency |
| element defined lazily after load | define on import of the entry |
| `already-defined` | an installed package owns the tag: rename it |
| hard-coded colours | `--ui-*` tokens (mywebui-theming) |
| `Array` property for data | `Object` (or a JSON `String`) |

Full guide and the BaseCustomWebComponent API: `docs/npm-widgets.md`.
