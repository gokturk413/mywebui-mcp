---
name: mywebui-reports
description: Use when building a mywebui report (.report) - page, header/footer, theme, history tables, KPIs, ECharts charts (iobroker-webui-echart), HTML/PDF/CSV generation, schedules or trigger signals, report scripts; or when a control is a placeholder box in a generated file, a chart is blank in the PDF, or a script fails only on the server.
---

# mywebui reports

A report is a screen shaped as paper (`<project>/data/reports/<name>.report`): the same html,
style, script, properties, bindings and template directives, plus page size, bands and an
output. It is shown live in the **report viewer** and generated as a **file** on the server with
no browser: templates and bindings run in the report engine, every piece of user JavaScript
in a QuickJS sandbox with a DOM that has no layout.

## What works in a generated file

| Works | Refused or a still |
|---|---|
| bindings, `[[…]]`, `repeat:`, `for:`, `if`, `history:` directives, `<t-t>` | `getBoundingClientRect`, `offset*`, `client*`, `scroll*` sizes |
| `.control` custom controls (template + script) | `<canvas>`, `<iframe>`, `requestAnimationFrame` |
| `IOB.getState`, `IOB.subscribeState` (calls back once), `IOB.getObject`, `IOB.t` | `import` of packages, npm widgets (placeholder) |
| `Intl.*`, `toLocaleString` (report language), `TextEncoder`, `URL`, `structuredClone`, `crypto.randomUUID`, `atob`/`btoa` | `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker` |
| `getComputedStyle` (theme tokens), `ResizeObserver` (once), `DOMParser`, `MutationObserver` | writes: `IOB.setState`, `secWriteState` do nothing |
| `<img src="/mywebui.0.projects/<project>/data/images/logo.png">` (embedded, ≤ 5 MB) | timers run once, straight away |

A refused control renders as a labelled placeholder; saving the report warns and frames it red.

## History data

Put a `history-root:rows='{"id":"…","last":"24h", "expression":"…"}'` directive on the page (or let
the **History Query** window write it), then show `this.rows` with `repeat:` or a chart. The
report's time range (range picker / *Time range from states*) replaces `last` / `start` / `end`.
Rows `{val, ts, q, ack}`: ask for `q` and drop `q ≠ 0`. More than 10 000 rows fails the run.

## Charts

```html
<iobroker-webui-echart source="rows" kind="trend"
  style="position:absolute;left:60px;top:330px;width:480px;height:240px"></iobroker-webui-echart>
<iobroker-webui-echart source="rows" option="return { xAxis:{type:'time'}, yAxis:{},
  series:[{ type:'bar', encode:{ x:'ts', y:'flow1' } }] }"></iobroker-webui-echart>
```

`source` (a property or `local_x`), `data` (property), `kind` (`trend`, `area`, `bar`, `gauge`, `pie`),
`option` (JSON or JS returning it), `theme` (`auto`, `light`, `dark`), `renderer` (`svg`, `canvas`),
`preset` (`echarts.0.preset_1`), `file-mode` (`svg`, `live`). Files get a server-side SVG.

## Theme, output, triggers

- Page → Theme: `paper` (default; light tokens on white), `runtime`, or a theme name (`settings.theme`).
- Generate in the browser (download, for the logged-in user), **Save on server**, schedule, or a
  signal (an ioBroker state is watched by the server; `local_` / `??prop` only while a page shows it).
  Scheduled runs render for the report's **Run as** user; group-limited elements are left out otherwise.
- From scripts: `IOB.api.generateReport({report, format})`, server `report.generate(name, {format})`.

## Report checklist for a control

1. Size with CSS, `%` or `viewBox`, never a measured pixel value; prefer SVG.
2. Read values through bindings or `IOB`; no own connections.
3. The final picture must not depend on timers or animation.
4. No imports. Save the report: no warning = it renders.

Full guide: `docs/reports.md`, `docs/custom-controls.md` §10.
