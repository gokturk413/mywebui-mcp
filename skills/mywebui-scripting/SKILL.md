---
name: mywebui-scripting
description: Use when making a mywebui element or screen react to a click, a key or a value change - Simple Script command lists (JSON), Blockly, screen-script JavaScript functions, the Global Script, IOB.api functions, or the browser IOB API (getState, setState, subscribeState, sendTo, openFaceplate, getCurrentUser); or when a script command is refused or does nothing.
---

# mywebui scripting (browser side)

Three ways on the same event, side by side: **Simple Script** (a JSON command list, no code),
**Blockly** (category *mywebui*), **JavaScript** (an exported function of the screen / control
script). Every command and `IOB.api` call is checked like the user acting by hand: security
model (`data-action` + area), screen access, ioBroker rights, Confirm & Protect. A refused step
shows a notice and **ends the script**; a JS call returns `{ denied: true, reason }`.

## Simple Script

```json
{ "commands": [
  { "type": "ShowMessageBox", "title": "Stop", "message": "Stop the line?", "buttons": "yesNo", "resultSignal": "0_userdata.0.ui.answer" },
  { "type": "Condition", "value1": { "source": "signal", "name": "0_userdata.0.ui.answer" }, "comparisonType": "==", "value2": 1, "falseGotoLabel": "end" },
  { "type": "SetSignalValue", "signal": "0_userdata.0.line.stop", "value": true },
  { "type": "Label", "label": "end" }
] }
```

Value sources (`{ "source": …, "name": … }`): `signal`, `property`, `elementProperty`,
`signalInProperty`, `event`, `parameter`, `context`, `complexString` (`"Level {a.0.x} %"`),
`complexSignal`, `expression`. `signalTarget`: `signal` (default), `property`, `elementProperty`.
A signal starting with `.` is relative.

Commands: [commands.md](commands.md).

## IOB.api (Simple Script, Blockly and JS share it)

```js
const r = await IOB.api.openScreen({ screen: 'pumps/detail' });   // also 'report:x', '3dscreen:x'
if (r?.denied) console.warn(r.reason);
if (await IOB.api.can({ action: 'setpointOverride' })) await IOB.api.setState({ id: '0_userdata.0.sp', value: 55 });
```

`setState`, `getState`, `toggleState`, `openScreen`, `open3DScreen`, `openDialog`, `navigateBack`,
`openFaceplate({type, root})`, `closeFaceplate`, `openReport`, `generateReport({report, format})`,
`setTheme`, `showNotice({title, text, kind})`, `controlAnimation`, `animate`, `controlEffects`, `can`.
Also `IOB.api.run('<name>', {…})`. New functions are added in `www/dist/frontend/common/ScriptApi.js`
with `scriptApi.define({name, group, command, description, params, check, run})`.

## The browser IOB API

| Call | Notes |
|---|---|
| `await IOB.getState(id)` | `{val, ts, ack, q}`; `null` without read right |
| `await IOB.setState(id, val, ack?, { feedback: el })` | typed by `common.type`; resolves `{denied:true}` when refused |
| `await IOB.whenWriteConfirmed(id)` | did the driver confirm? |
| `IOB.subscribeState(id, cb)` / `IOB.unsubscribeState(id, cb)` | `cb(id, state)`; always pair them |
| `IOB.getObject(id)`, `IOB.subscribeObject` / `unsubscribeObject` | |
| `IOB.connection.sendTo(instance, cmd, msg)` | needs the group right *Other → sendTo* |
| `await IOB.access(id)` | `{read, write, reasonRead?, reasonWrite?}` |
| `await IOB.getCurrentUser()`, `IOB.userName` | `{id, groups}` |
| `IOB.secCan(action, el)`, `await IOB.secWriteState(id, val, {action, element})` | mywebui-security |
| `IOB.openFaceplate(type, root)`, `IOB.openFind(q)`, `IOB.openMessages()`, `IOB.openJournal()`, `IOB.pointAt(el)` | |
| `IOB.t(key, el)`, `IOB.language`, `IOB.setLanguage(l)` | mywebui-translations |
| events: `languageChanged`, `translationsChanged`, `securityChanged`, `objectsChanged`, `configChanged`, `refreshView`, `changeView` | `.on(fn)` returns a disposable |

## Global Script

Designer → Global → **Global Script**: an ES module whose `export async function init()` runs once
at designer and runtime start (load theme CSS of a library, register helpers). Keep it small: it
delays every page.

## Common mistakes

| Mistake | Fix |
|---|---|
| `Run script` command | not implemented; use a *Javascript* command or an exported function |
| `IOB.setState` for a guarded action | `IOB.secWriteState` or a Confirm rule |
| subscribing without unsubscribing | pair in `disconnectedCallback` |
| trusting a user name sent in `sendTo` | identity comes from the session (gateway) |

Full guides: `docs/simple-script.md`, `docs/script-functions.md`.
