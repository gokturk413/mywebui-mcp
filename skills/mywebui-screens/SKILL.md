---
name: mywebui-screens
description: Use when creating or changing a mywebui screen (.screen file) - its html, style, script, properties, settings, layout (flex, grid, split, tabs), stretch, transitions, navigation menu entry, startup screen, multi-view elements, foreignObject (HTML inside SVG) or screen script; or when a screen opens blank, flashes half-built, is cut on a phone, or the runtime opens the wrong screen.
---

# mywebui screens

A screen is `<project>/data/screens/<name>.screen`, the same five keys as a control:

```json
{ "html": "<div style=\"position:absolute;left:40px;top:40px\" …></div>",
  "style": "", "script": "export function init(instance, shadowRoot) {}",
  "properties": { "selectedPump": { "type": "string", "default": "1" } },
  "settings": { "width": "1920px", "height": "1080px", "stretch": "uniformToFill",
                "layout": { "type": "none" },
                "navigation": { "show": true, "title": "Pumps", "order": 1, "group": "", "image": "" },
                "transition": { "effect": "fade", "waitForReady": true, "duration": 150, "fallbackMs": 8000 } } }
```

- Elements are placed with `position:absolute; left; top; width; height` unless a layout flows them.
- `properties` are the screen's own properties: `??selectedPump` in bindings, `this.selectedPump` in
  `[[…]]`, set from outside through a screen viewer.
- `stretch`: `none`, `uniform` (letterbox), `uniformToFill` (cover; on touch screens it scrolls).

## Layout (`settings.layout`, metadata, never an element in the html)

| `type` | Fields |
|---|---|
| `none` | |
| `flex` | `direction`, `wrap`, `justifyContent`, `alignItems`, `gap`, `padding` |
| `grid` | `gridTemplateColumns`, `gridTemplateRows` (a bare `1fr` becomes `minmax(0,1fr)`), `gap`, `padding` |
| `split` | `orientation` (`horizontal`), `splitPosition` (50): first child = pane 1, the rest pane 2 |
| `tabs` | `tabLabels` **pipe-separated string** `"A|B"`, `active`, `tabPosition`: one top-level child per tab |

Dashboards on phones: grid with `grid-auto-rows:max-content` and `overflow-y:auto`.

## Transitions

`effect`: `none`, `fade`, `slideUp` (not `slide`), `zoom`, `blur`. With `waitForReady` the screen is
shown when every custom element is defined and ready (`whenScreenReady()`), at most `fallbackMs`.
Then `screen-ready` fires (`detail: {screenName, ready}`).

## Screen script

Loaded once per screen version and reused; `init` / `connectedCallback` run on every visit,
`disconnectedCallback` when leaving. Keep visit state on the viewer, not at module level. Undo
GSAP tweens, observers and library instances yourself. Event handlers named in the Events window
are exported functions, called as `(event, element, shadowRoot, instance, parameters)`:
`export async function openDetails(event, element) { … }`.

## Navigation, startup, multi-view

- Menu entry: `settings.navigation` (`show`, `title` (translation key allowed), `order`, `group`
  (`"Station A/Pumps"`), `image` (SVG drawn in the theme colour), `badge` (a state id)). Project-wide:
  `config.navigation` (`position` left|right|top|bottom, `groupBy` none|folder|group, `groups`).
- Startup: `config.startScreen = { default: "<screen>", byGroup: [{group, screen}] }`, else `start`.
- Multi-view: `multi-views="Alarms,Overview"` + an `id` on an element shows it on those screens
  at the same place; the index `config.multiViews` is rebuilt on save.
- Open other screens: Simple Script *Open screen* / *Open dialog*, `IOB.api.openScreen({screen})`,
  `report:<name>`, `3dscreen:<name>`; nested screens with `<iobroker-webui-screen-viewer>`.

## HTML inside an SVG

```html
<svg viewBox="0 0 200 100" style="width:400px;height:200px">
  <foreignObject x="50" y="25" width="50" height="50">
    <div style="position:relative;width:100%;height:100%">
      <webui-gauges-setpoint-gauge style="position:absolute;left:0;top:0;width:100%;height:100%"></webui-gauges-setpoint-gauge>
    </div>
  </foreignObject>
</svg>
```

## Common mistakes

| Mistake | Fix |
|---|---|
| `runtime.html?screenName=x` | `runtime.html#screenName=x` |
| a wrapper `<div>` for the layout in the html | `settings.layout` |
| `tabLabels: ["A","B"]` | `"A|B"` |
| screen saved to disk | files DB (`iobroker file write` or the designer) |
| editing an injected multi-view copy | edit it on its home screen and save |

Full guide: `docs/screens.md`; shipped controls (gauges, PlantPAx, pipes, alarms, dashboard): `docs/scada-controls.md`.
