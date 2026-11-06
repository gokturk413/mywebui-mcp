---
name: mywebui-template-directives
description: Use when writing [[expressions]], if / else-if / else, switch / case, repeat:, for:, ref:, show, @event, css:, class:, $attr, ?attr or history: / history-root: / history-var: in a mywebui custom control template, screen page or report page; or when a list re-renders, a ref is undefined, a range loop counts wrong or HTML from a state is injected.
---

# mywebui template directives

`[[…]]` is any JavaScript expression; `this` is the custom control, or the screen / report whose
page it is. They work in custom controls and, since 1.155, directly on screens and reports
(viewer and generated files). ioBroker states come in through bindings (mywebui-bindings), not
through `[[…]]`.

## Quick reference

| Write | Does |
|---|---|
| `[[expr]]` in text | inserts as **HTML** (`innerHTML`) |
| `[[text:expr]]`, `bcw:text="[[expr]]"` | inserts as text: use for anything from states or users |
| `[[?expr]]` | null / undefined / false → empty |
| `.prop="[[expr]]"` · `$attr="[[expr]]"` · `?attr="[[expr]]"` | property · attribute · boolean attribute |
| `css:width="[[this.p + '%']]"` | one inline style |
| `class:has-error="[[this.v < 0]]"` | toggles the class named as written |
| `show="[[expr]]"` | `display:none` when false, element stays |
| `<template if="[[a]]">` `<template else-if="[[b]]">` `<template else>` | adds / removes DOM; consecutive siblings |
| `<template switch:v="[[x]]"><template case="1">…<template default>` | one branch |
| `<template repeat:item="[[arr]]" repeat-index="i">` | one copy per item |
| `<template for:i="[[n]]">` · `[[3, 7]]` · `[[0, 100, 25]]` | 1…n · 3…7 · 0,25,…,100 (ends included) |
| `ref:my-canvas` | `this.refs.myCanvas` after `connectedCallback` |
| `@click="[[this.go(event)]]"` · `@@value-changed` | event · camelCase event `valueChanged` |
| `history-root:rows='{"id":"…","last":"24h"}'` | history rows into `this.rows` (see reference) |

## Loop variables in state ids

Inside `for:` / `repeat:`, the loop variable is also an element property, so a binding path can use
it with `{##name}`:

```html
<template for:i="[[this.pumpCount]]">
  <webui-pumps-pump bind-prop:running="0_userdata.0.pump{##i}.running"></webui-pumps-pump>
</template>
```

## Refreshing

A control property setter refreshes the bindings that read it. After changing something else
call `instance._bindingsRefresh('name')` (only what reads `this.name`) or `_bindingsRefresh()`.

## Common mistakes

| Mistake | Fix |
|---|---|
| `[[this.alarmText]]` with text from a state | `[[text:this.alarmText]]` (else HTML injection) |
| `ref:myCanvas` | `ref:my-canvas` (attributes are lower-cased) |
| another element between `if` and `else-if` | keep the `<template>`s adjacent |
| `JSON.parse(...)` building the `repeat:` list on every refresh | keep the objects; same object = kept element |
| a raw `<b>` inside `[[ … ]]` | write `&lt;b&gt;` |
| `bind-signal:` | does not exist; use `bind-prop:` or `IOB.subscribeState` |
| `<t-t>` mixed with text | `<span><t-t>key</t-t>: [[text:this.v]]</span>` |

Full syntax, `history:` options and examples: [reference.md](reference.md).
