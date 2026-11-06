---
name: mywebui-custom-controls
description: Use when creating, editing or reviewing a mywebui custom control (.control JSON file, webui-* element) - its properties, settings, html template, style, script hooks (init, connectedCallback, disconnectedCallback) or translations; or when a control leaks memory, shows stale values, or renders wrong in a report.
---

# mywebui custom controls

A custom control is one JSON file, `<name>.control`, that becomes the element `<webui-<name>>`
with a shadow DOM. No build step. **REQUIRED BACKGROUND:** mywebui-development (storage, names).

## The file

```json
{
  "properties":   { "<name>": { "type": "number", "default": 0 } },
  "settings":     { "width": "220px", "height": "120px" },
  "html":         "<div id=\"v\">[[this.value]]</div>",
  "style":        ":host{display:block;color:var(--ui-text,#e2e6ec)}",
  "script":       "export function init(instance, shadowRoot) {}",
  "translations": { "en": { "title": "Level" }, "az": { "title": "Səviyyə" } }
}
```

`html`, `style` and `script` are JSON-escaped strings. Parse the file, never edit it as text.
A complete control: [example-tank-level.control](example-tank-level.control).

## Properties

| `type` | Element value | Designer editor |
|---|---|---|
| `string`, `color`, `signal`, `screen` | String | text, colour picker, state picker, screen picker |
| `enum` + `"values": ["a","b"]` | String | drop-down |
| `number` / `boolean` / `date` / `object` | Number / Boolean / Date / Object | |

- Defaults are set before the first binding pass, so `[[this.price.toFixed(2)]]` is safe.
- `"internal": true`: an accessor, but not settable from markup.
- `axis_min`, `axis_max` form a collapsible group `axis` in the grid (part before the first `_`).
- Each setter fires `<dash-name>-changed` (`barThickness` → `bar-thickness-changed`).
- Store JSON lists as a `string` property when they should stay editable as text.
- A `signal` property holding a state id is what read-quality marks and Confirm rules find.

## Script hooks (an ES module; `export` required, top-level `await` works)

| Hook | Runs |
|---|---|
| `init(instance, shadowRoot)` | on every connect, after bindings are applied |
| `connectedCallback(instance, shadowRoot)` | every time it enters the DOM; keep it cheap |
| `disconnectedCallback(instance, shadowRoot)` | on removal: undo everything global |

Helpers on `instance`: `_getDomElement(id)`, `_getDomElements(selector)`,
`_bindingsRefresh(name?)` (only bindings reading `this.<name>`), `_assignEvent(event, cb)`
(host listener, removed for you, returns `{remove()}`), `_getRelativeSignalsPath()`, `refs.<name>`.

## Memory: undo in disconnectedCallback

| Registered | Undo |
|---|---|
| `IOB.subscribeState(id, cb)` | `IOB.unsubscribeState(id, cb)`, with `cb` kept on `instance` |
| `IOB.securityChanged.on(fn)`, `languageChanged`, … | `instance.__off = …on(fn)` → `instance.__off.dispose()` |
| `window`/`document`/`matchMedia` listener | `removeEventListener` with the same function |
| `setInterval`, a long `setTimeout` | `clearInterval` / `clearTimeout` |
| GSAP tweens, observers, chart/map instances | `.kill()`, `.disconnect()`, `.dispose()` |
| an element moved to `document.body` | remove it |

The runtime's safety net (ScriptLifetime) catches some of these, but only for synchronous calls in
`init`/`connectedCallback`. Write `disconnectedCallback` anyway.

A script with **no** module-level state (top-level `let`/`var`/`class`, or `const x = {…}/[…]/new …`)
is one module shared by all instances. Keep all state on `instance`.

## settings

`width`/`height` (design size, always set), `useGlobalStyle` (adopt the project's Global Style),
`bindToSize` (width/height usable as binding sources), `layout` (flex/grid of the children),
`visibilityEnabled/Groups/Action/RedirectScreen` (group visibility).

## Writing values

Write with `IOB.setState(id, value)` (typed by `common.type`, with write feedback). When the
outcome matters: `const r = await IOB.whenWriteConfirmed(id)` → `r.confirmed` true/false/null.
For a guarded action use `IOB.secWriteState` (mywebui-security). Set the shown value from every
update, also an equal one.

## Reports

Reports render controls on the server in a sandbox (QuickJS + a DOM without layout). These are
refused: `getBoundingClientRect`, `offsetWidth/Height`, `clientWidth/Height`, `scrollWidth/Height`,
`requestAnimationFrame`, `<canvas>`, `<iframe>`, `import` of packages. Timers run once. Size with
CSS/`viewBox`, prefer SVG. Details: mywebui-reports.

## Common mistakes

| Mistake | Fix |
|---|---|
| state kept in a top-level `let` | `instance.__x` |
| listener added in `init` never removed | remove it in `disconnectedCallback` |
| `if (v === instance._last) return;` before showing a value | always apply the update |
| `querySelector` / `addEventListener` on the host | `_getDomElement` / `_assignEvent` |
| `fill="#fff"` with `var()` in an SVG attribute | `style="fill:var(--ui-text,#fff)"` |
| hard-coded text | `<t-t>key</t-t>` + `translations` |
| `My Control` as name | `my-control` (tag `webui-my-control`) |

Full guide: `docs/custom-controls.md`.
