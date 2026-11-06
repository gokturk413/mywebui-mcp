---
name: mywebui-development
description: Use when working on anything for mywebui, the ioBroker SCADA/HMI visualisation adapter (iobroker.mywebui): screens, custom controls (.control), npm widgets, reports, 3D screens, scripts, themes, translations or marketplace packages, or when a task mentions IOB, window.IOB, webui-*, mywebui.0, runtime.html or the mywebui designer.
---

# mywebui development

mywebui is an ioBroker adapter that serves a designer and a runtime through `web.0`. Everything an
author makes is a JSON file in the ioBroker **files DB**, never a file on the server's disk. The
browser global `window.IOB` is the API.

## Which skill for what

| Task | Skill |
|---|---|
| a reusable control made inside mywebui (`.control`) | mywebui-custom-controls |
| `[[…]]`, `if`, `switch`, `repeat:`, `for:`, `ref:`, `@click`, `history:` in a template | mywebui-template-directives |
| showing or writing a live ioBroker value (`bind-prop:`…), animations, effects | mywebui-bindings |
| a control written in JS/TS, built and published to npm (Lit, BaseCustomWebComponent) | mywebui-npm-widgets |
| texts in several languages | mywebui-translations |
| colours, light/dark, themes | mywebui-theming |
| screen layout, navigation menu, transitions, multi-view, startup screen | mywebui-screens |
| clicks and value changes without code (Simple Script), `IOB.api`, screen and Global Script | mywebui-scripting |
| JavaScript that runs on the server all the time | mywebui-server-scripts |
| reports (PDF/HTML/CSV), history queries, ECharts | mywebui-reports |
| who may see or write what, confirm dialogs, passwords | mywebui-security |
| `.mwpkg` packages, registry, signing, licence keys | mywebui-marketplace |
| a tool (VS Code, an agent) that drives the designer | mywebui-developer-bridge |

## Choosing the kind of artifact

| Want | Make |
|---|---|
| no build step; the source travels with the project | custom control (`.control`) |
| a JS/TS library, versions, npm, unit tests | npm widget |
| one screen's logic | bindings + template directives on the screen; script only for the rest |
| logic with no browser open | server script |

Prefer declarative bindings and directives. Write a script only for what they cannot express.

## Where things are stored (files DB)

| Thing | Namespace | Path |
|---|---|---|
| screen | `mywebui.0.projects` | `<project>/data/screens/<name>.screen` |
| project control | `mywebui.0.projects` | `<project>/data/controls/<name>.control` |
| global control (every project) | `mywebui.0.data` | `global/controls/<name>.control` |
| report | `mywebui.0.projects` | `<project>/data/reports/<name>.report` |
| translations | `mywebui.0.projects` | `<project>/data/translations.json` |
| security model | `mywebui.0.projects` | `<project>/data/security.json` |
| project config (navigation, multi-view, …) | `mywebui.0.projects` | `<project>/data/config.json` |
| npm widgets | `mywebui.0.projects` | `<project>/widgets/` (own `package.json`, `node_modules`) |

`<name>` may contain folders: `pumps/station`. Write these files with the designer, the developer
bridge or `iobroker file write <src> <namespace>/<path>`. Copying into the adapter folder on disk
does nothing. An open designer or runtime reloads a file only after the `objectChanged` command
(the designer's save sends it).

## Names and URLs

- A control's tag is `webui-` + its path in dash-case: `gauges/linear-gauge` → `<webui-gauges-linear-gauge>`,
  `theme/theme-selector` → `<webui-theme-theme-selector>`. Use lower-case, dash-separated names.
- Designer `http(s)://<host>:<web port>/mywebui/index.html`, runtime `…/mywebui/runtime.html`.
  Screen by **hash**: `runtime.html#screenName=pumps/station`. Project by query: `?project=name`.
  Without a screen name the runtime opens the startup screen, else the screen `start`.

## Rules that hold everywhere

1. Colours come from theme tokens: `var(--ui-text, #e2e6ec)`, never a bare hex for chrome.
2. Visible text comes from translations: `<t-t>key</t-t>` or `IOB.t('key', instance)`.
3. What a script registers outside its element (subscriptions, listeners, timers, observers,
   tweens) is undone in `disconnectedCallback`. Screens stay open for days.
4. Per-instance state lives on `instance` / `this`, never in module-level `let`/`var`.
5. A control that shows a written value takes **every** state update, even an equal one: an
   unconfirmed write sends the old value back that way.
6. Security-relevant writes go through `IOB.secWriteState` or Confirm & Protect; UI hiding is
   only convenience.
7. Never write to plant states while testing; use `0_userdata.0.*` test states.

## Reference documentation

The full guides ship in the adapter package, `node_modules/iobroker.mywebui/docs/`, and in the
public repository https://github.com/gokturk413/ioBroker.mywebui/tree/main/docs. Start at
`docs/README.md`. When a skill and a guide disagree, the guide of the installed version wins.
