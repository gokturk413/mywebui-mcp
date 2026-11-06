# Simple Script commands

A script is `{ "commands": [ { "type": "<Type>", …fields } ] }`, run top to bottom. Any field can be
a fixed value or a value source `{ "source": "signal", "name": "a.0.x" }` (see SKILL.md). On the
signal commands, `signalTarget` chooses what is written: `signal` (default), `property`,
`elementProperty`.

## States

| `type` | Fields |
|---|---|
| `SetSignalValue` | `signal`, `value`, `signalTarget` |
| `ToggleSignalValue` | `signal`, `signalTarget` |
| `ToggleSignalValueThroughList` | `signal`, `valueList`, `signalTarget` |
| `IncrementSignalValue` / `DecrementSignalValue` | `signal`, `value`, `signalTarget` |
| `SetBitInSignal` / `ClearBitInSignal` / `ToggleBitInSignal` | `signal`, `bitNumber` (0 = lowest), `signalTarget` |
| `CalculateSignalValue` | `formula` (`{a.0.level} * 100 + 30`), `targetSignal`, `signalTarget` |
| `SubscribeSignal` / `UnsubscribeSignal` | `signal`, `oneTime` |
| `WriteSignalsInGroup` / `ClearSignalsInGroup` | `group` |
| `CopySignalValuesFromFolder` | `sourceFolder`, `destinationFolder` |
| `ExportSignalValuesAsJson` / `ImportSignalValuesFromJson` | `regex`, `fileName`, `waitForUpdatedValues` / `data` |

## Screens and windows

| `type` | Fields |
|---|---|
| `OpenScreen` | `screen` (`name`, `report:name`, `3dscreen:name`), `noHistory`, `relativeSignalsPath` |
| `OpenDialog` | `screen`, `title`, `width`, `height`, `left`, `top`, `moveable`, `closeable`, `cssClass`, `relativeSignalsPath` |
| `CloseDialog` | |
| `OpenScreenInScreenViewer` | `screen`, `targetSelector`, `relativeSignalsPath` |
| `Open3DScreen` | `screen` |
| `NavigateBack` | |
| `OpenUrl` | `url`, `target`, `openInDialog` |
| `ShowMessageBox` | `title`, `message`, `messageType`, `buttons`, `resultSignal` (clicked button, from 1), `width`, `height` |
| `ShowNotice` | `title`, `text`, `kind` (`info`, `ok`, `warn`, `error`) |

## Faceplates, reports, view

| `type` | Fields |
|---|---|
| `OpenFaceplate` / `CloseFaceplate` | `type` (`P_AIn` …), `root` (root of the instance's states) |
| `OpenReport` | `report` |
| `GenerateReport` | `report`, `format` (`html`, `pdf`, `csv`) |
| `SetTheme` | `theme` |
| `SwitchLanguage` | `language` |

## Animations and effects

| `type` | Fields |
|---|---|
| `ControlAnimation` | `target` (CSS selector, empty = the element), `action` (`play`, `pause`, `resume`, `stop`, `restart`, `reverse`), `index` |
| `Animate` | `target`, `effect`, `from`, `to`, `duration`, `repeat`, `yoyo`, `ease` |
| `ControlEffects` | `target`, `action` |

## Elements and users

| `type` | Fields |
|---|---|
| `SetElementProperty` | `target` (`property`, `attribute`, `css`, `class`), `name`, `value`, `mode` (class: `add`, `remove`, `toggle`), `targetSelector`, `targetSelectorTarget` (`element`, `container`), `parentIndex` |
| `Login` | `username`, `password` |
| `Logout` | |

## Flow

| `type` | Fields |
|---|---|
| `Condition` | `value1`, `comparisonType` (`==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `\|\|`, `==true`, `==false`, `==null`, `!=null`), `value2`, `trueGotoLabel`, `falseGotoLabel` (no label = next command) |
| `Label` / `Goto` | `label` |
| `Exit` | |
| `Delay` | `value` (ms) |
| `Javascript` | `script`; `context.event`, `context.element`, `context.shadowRoot`, `context.instance` |
| `Console` | `message`, `target` (`log`, `info`, `warn`, `error`, `debug`) |
| `Comment` | `comment` |
| `RunScript` | not implemented: does nothing |

The designer's **Code** button shows any script as this JSON; build it there when unsure of a field.
