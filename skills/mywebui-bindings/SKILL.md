---
name: mywebui-bindings
description: Use when connecting a mywebui element to an ioBroker state, object, local variable or control property - bind-prop:, bind-attr:, bind-css:, bind-cssvar:, bind-class:, bind-content:, bind-visible:, two-way =, inverted !, expressions with __0, relative or indirect state ids, data-animation / data-effects JSON; or when a value does not update, a write is not confirmed, or a written number arrives as text.
---

# mywebui bindings

A binding is an attribute `bind-<target>:<name>="<source>"`. It is reactive (one subscription per
state, removed with the element) and works on screens, in control templates, on npm widgets and
in reports.

## Targets

| Attribute | Sets |
|---|---|
| `bind-prop:value` | `element.value` (use dash-case for camelCase: `bind-prop:text-content`) |
| `bind-attr:fill` | `setAttribute('fill', v)` (SVG attributes) |
| `bind-css:background-color` | `element.style` |
| `bind-cssvar:accent` | `--accent` (write it **without** `--`) |
| `bind-class:running` | toggles class `running` |
| `bind-content:text` | text content |
| `bind-visible:` | `visibility: collapse` when false |

## Sources

| Source | Gives |
|---|---|
| `adapter.0.some.state` | `state.val` |
| `state:adapter.0.x` | the whole state `{val, ts, ack, q, from}` |
| `object:adapter.0.x` | the object `{common, native}` (unit, min, max, `common.states`) |
| `local_name` | a browser-local variable (`local_language`, `local_username` are set by mywebui) |
| `??prop` | a property of the root (control / screen / report), reactive |
| `##prop` | a property of the element itself |
| `?prop` | the root property **holds a state id**; that state is bound, and re-bound when the property changes |
| `.sub.path` | relative: the control's / screen's relative signals path + `sub.path` |
| `a.0.{local_room}.temp` · `pump_{??nr}.run` · `p{##i}.run` | id built from other values, re-subscribed on change |

## Modifiers and expressions

```html
<span bind-content:text="0_userdata.0.temp;0_userdata.0.unit;Math.round(__0) + ' ' + __1"></span>
<div  bind-class:alarm="?signal;??alarmHigh;Number(__0) >= Number(__1)"></div>
<input type="number" bind-prop:value="=0_userdata.0.setpoint">          <!-- two-way -->
<sl-switch bind-prop:checked="=modbus.0.coils.1::sl-change"></sl-switch>  <!-- two-way on an event -->
<div bind-prop:hidden="!0_userdata.0.panel.visible"></div>                <!-- inverted -->
```

- `src1;src2;expression`: the part after the last `;` is the expression; sources are `__0`, `__1`…
  (`lvl:adapter.0.x` names one `lvl`). `this` is the root, `__ctx.element` the element.
- A formula with several statements needs `return`; use the binding editor (stored as JSON:
  `{"signal":"…","expression":"…","twoWay":true,"converter":{…}}`).
- Two-way writes are typed by the state's `common.type` (`"49"` → `49`), shown with write feedback,
  and **not shown until the driver confirms** (`ack: true`); unconfirmed, the old value comes back.

## Animations and effects

`data-animation` (GSAP; object or array) and `data-effects` (one-shot / triggered presets) are
JSON attributes. Every field has a `<field>_bind: {signal}` twin taking any source above;
`controls.play|pause|resume|stop|reverse` = `{oid_bind, condition, value}` with conditions
`equal`, `not_equal`, `less_than`, `less_equal`, `greater_than`, `greater_equal`, `exists`.
Effects, fields and examples: [reference.md](reference.md).

## Common mistakes

| Mistake | Fix |
|---|---|
| `bind-cssvar:--accent` | `bind-cssvar:accent` |
| `bind-prop:textContent` | `bind-prop:text-content` (HTML lower-cases attribute names) |
| polling a state with `setInterval` | a binding or `IOB.subscribeState` |
| expecting `await IOB.setState()` to mean the device has it | `await IOB.whenWriteConfirmed(id)` |
| `??prop` on a plain screen element for a control's property | inside the control's template only; on a screen `??` reads screen properties |
| a two-way input dropping an update equal to its value | always apply updates |

Write feedback, read quality marks, Messages, state details: `docs/bindings.md`, `docs/status-indicators.md`.
