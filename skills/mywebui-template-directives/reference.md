# Template directives: reference

Engine: `@gokturk413/base-custom-webcomponent` (`www/libs/@gokturk413/base-custom-webcomponent/dist/BaseCustomWebComponent.js`).
Expressions are compiled with `new Function` and cached; CSP needs `unsafe-eval`.

## Text

```html
<span>[[this.count + ' pcs']]</span>          <!-- HTML -->
<span>[[text:this.message]]</span>            <!-- text, shown literally -->
<span bcw:text="[[this.note]]"></span>        <!-- the element's contents as text -->
<span>[[?this.optional]]</span>               <!-- empty for null/undefined/false -->
<span>[[text:?this.optional]]</span>
```

## Properties, attributes, styles, classes

```html
<my-chart .data="[[this.rows]]"></my-chart>
<div $title="[[this.tooltip]]"></div>
<button ?disabled="[[this.busy]]">Send</button>
<div css:background-color="[[this.ok ? 'var(--ui-ok)' : 'var(--ui-error)']]"></div>
<div class:active="[[this.selected]]"></div>
```

## Conditions

```html
<template if="[[this.status === 'running']]"><b>Running</b></template>
<template else-if="[[this.status === 'fault']]"><b>Fault</b></template>
<template else><b>Stopped</b></template>

<template switch:v="[[this.level]]">
  <template case="0">Normal</template>
  <template case="2">Critical</template>
  <template default>Level [[this.level]]</template>
</template>

<div show="[[this.count > 0]]">[[this.count]] found</div>   <!-- old form: bcw:visible -->
```

## Lists

```html
<template repeat:row="[[this.rows || []]]" repeat-index="i">
  <tr><td>[[i + 1]]</td><td>[[text:row.name]]</td></tr>
</template>
<template repeat:e="[[Object.entries(this.config)]]"><div>[[e[0]]]: [[e[1]]]</div></template>

<template for:i="[[this.count]]">…</template>          <!-- 1 … count -->
<template for:i="[[3, 7]]">…</template>                 <!-- 3 … 7 -->
<template for:p="[[0, 100, 25]]"><option value="[[p]]">[[p]] %</option></template>
```

- An item is kept when the list holds the same value (`Object.is`): its elements, focus and inner
  controls survive; its bindings run again. New items are created, gone ones removed.
- `repeat-changed-item-callback` runs with `callbackType` `create` / `remove`.
- In bindings inside the loop: `{##i}`, `{##row}` (the loop variables are element properties).
  `.myidx="[[i]]"` + `{##myidx}` names it yourself.

## Refs and events

```html
<canvas ref:my-canvas width="400" height="300"></canvas>
<button @click="[[this.start(event)]]">Start</button>
<input @input="[[this.value = event.target.value]]">
<my-el @@value-changed="[[this.onChange(event.detail)]]"></my-el>   <!-- event "valueChanged" -->
<div @touch:contextmenu="[[this.menu(event)]]"></div>
```

```js
export function connectedCallback(instance) {
    const ctx = instance.refs.myCanvas.getContext('2d');   // not in reports: <canvas> is refused there
}
```

## History: `history:` / `history-root:` / `history-var:`

Reads ioBroker history with the history adapter's own `sendTo(<instance>, 'getHistory', {id, options})`.
Works on screens, reports (viewer and generated files), custom controls and npm widgets.

| Directive | Value goes to | Read it with |
|---|---|---|
| `history:rows` | `element.rows` | the element itself (a widget's property) |
| `history-root:rows` | `this.rows` of the screen / report / control (add `rows` as a property, type `object`) | `[[this.rows]]`, `??rows`, `repeat:` |
| `history-var:levels` | local state `local_levels` | `bind-…="local_levels"` |

Names are dash-case in markup: `history:text-content` → `textContent`.

Value: a state id, or JSON:

| Key | Meaning |
|---|---|
| `id` | state id, or `"??prop"` to read the id from a property |
| `ids` | several states → `{ id: rows, … }` |
| `last` | `"30m"`, `"24h"`, `"7d"`, `"2w"` or ms |
| `start` / `end` | absolute window (ms or date string), wins over `last` |
| `instance` | `history.0`, `sql.0`, `influxdb.0`; default: the system default history if it logs the state, else the first instance that does |
| `aggregate`, `step`, `count`, `limit`, `ignoreNull`, `round`, `q`, `ack`, … | passed to getHistory unchanged |
| `expression` | reshape: `__0` = rows, `this` = screen / control; return the value |
| `reload` | re-read every N seconds (browser) |
| `query` | the History Query builder's model; never sent to the adapter |

Rows: `[{ val, ts, ack?, from?, q? }]`, `ts` in ms ascending. Drop bad quality with `q` + a filter.

```html
<i history-root:rows='{"id":"??tag","last":"7d","q":true,
   "expression":"return __0.filter(r => r.q == 0 && r.val != null)"}'></i>
<table><tbody>
  <template repeat:r="[[this.rows || []]]">
    <tr><td>[[new Date(r.ts).toLocaleString()]]</td><td>[[r.val]]</td></tr>
  </template>
</tbody></table>
```

After each read the element dispatches `history-loaded` (`detail: {prop, target, value}`).
In reports the report's time range replaces `last` / `start` / `end`; `expression` runs in the
sandbox; more than 10 000 rows fails the run.

Saved into HTML the JSON quotes become `&quot;`: expected.
