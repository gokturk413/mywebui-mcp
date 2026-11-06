# Bindings: reference

Implementation: `www/libs/@gokturk413/web-component-designer-visualization-addons/dist/helpers/BindingsHelper.js`
(targets, parsing) and `www/dist/frontend/runtime/AnimationService.js` (animations, effects).

## Parsing the short form

```
[=][!]source1;source2;…;expression[::event1,event2]
```

- `=` two-way, `!` inverted, `::events` the events that write back (two-way only).
- Without `::`, the write-back event is `change` for `<input>` / `<select>`, the dash-case
  property name for a **Lit** element (`value`), and `<dash-name>-changed` for other elements.
  Name the event explicitly when in doubt: `=0_userdata.0.sp::value-changed`.
- The target name is converted dash → camel (`bind-prop:text-content` → `textContent`);
  `bind-attr:` keeps the name as written.
- A value starting with `{` is JSON: `{"signal":"a.0.x;b.0.y","expression":"return __0+__1",
  "twoWay":false,"inverted":false,"converter":{…},"events":["change"],"historic":{…}}`.

## More sources

| Source | Gives |
|---|---|
| `?@attr` / `#@attr` | an attribute of the root / of the element |
| `?$prop` / `#$prop` | a property of the root / of the element (as `??` / `##`) |
| `#prop` | the element's property holds the state id |
| `$adapter.0.x` | the object, read once |
| `state:{webui.0.pick}.target` | whole state of an id built from a placeholder |

## Write feedback and confirmed values

A write from the UI is sent with `ack: false`; the driver confirms with `ack: true`.

- Frame on the control: yellow dashed (waiting), green `✓ 180 ms`, red `✕` (timeout, bad quality,
  refused), orange `≠ 45` (another value confirmed), grey `= 49` (no change).
- The wait is `max(3 s, 2 × poll + 1 s)` of the driver instance.
- While waiting, nobody (no other control, no other browser) sees the unconfirmed value; if not
  confirmed, the old value is handed to every subscriber again. Nothing is written back.
- Watched: driver states and `alias.*`. Not watched: `0_userdata.*` (unless enabled), `local_*`,
  `system.*`, `mywebui.*`.
- Per element: `write-feedback="off"`, `write-feedback-timeout="8000"`, `write-feedback-restore="off"`,
  `read-quality="off"`. Events (bubbling, composed): `write-feedback` `{status, id, value, ackValue, ms, reason, restored}`,
  `read-quality` `{kind, problems}`.

```js
await IOB.setState(id, 90, undefined, { feedback: element });
const r = await IOB.whenWriteConfirmed(id);
// r.confirmed: true (ok | mismatch | same), false (error: timeout | refused | denied | quality), null (unwatched, cancelled, superseded)
```

## Animations: `data-animation`

```json
[{
  "effect": "rotation", "duration": 2, "ease": "none", "repeat": -1, "valueTo": 360,
  "transformOriginX": "50%", "transformOriginY": "50%",
  "duration_bind": { "signal": "0_userdata.0.speed" },
  "controls": {
    "play": { "oid_bind": { "signal": "?runSignal" }, "condition": "equal", "value": "true" },
    "stop": { "oid_bind": { "signal": "?runSignal" }, "condition": "equal", "value": "false" }
  }
}]
```

Effects: `opacity`, `scale`, `rotation`, `rotateAxisY`, `rotateAxisX` (agitator blades),
`translateX`, `translateY`, `translate` (`"x,y"`), `left`, `top`, `skew`, `fill`, `color`,
`backgroundColor` (`fillColorFrom` / `fillColorTo`), `transform`, `svg` (`svgAttr`), `motionPath`
(`pathId`), `morphSVG`, `flowDash` (`dashLen`, `gapLen`, `color`, `direction`), `pathFlow` (`count`,
`shape`, `size`, `color`, `direction`). `offset` (0–1) staggers elements on one path.
Bindable: `effect_bind`, `duration_bind` (live via timeScale), `ease_bind`, `repeat_bind`,
`yoyo_bind`, `valueTo_bind`, `valueFrom_bind`, `fillColorTo_bind`, `fillColorFrom_bind`,
`transformOriginX_bind` / `Y`, `svgAttr_bind`, `pathId_bind`; controls take `oid_bind`,
`condition_bind`, `value_bind`.

## Effects: `data-effects`

```json
{ "type": "pulse", "trigger": "oid", "duration": 0.5, "repeat": 3,
  "oid_bind": { "signal": "0_userdata.0.alarm.active" }, "condition": "equal", "conditionValue": "true" }
```

Types: `fadeIn`, `fadeOut`, `slideInLeft|Right|Top|Bottom`, `bounce`, `pulse`, `shake`, `glow`,
`blur`, `spin`, `flip`, `axisSpin`, `axisSpinX`, `pulseRing`, `flowDash`, `pathFlow`.
Triggers: `load`, `hover`, `click`, `oid`.

From scripts: `IOB.api.controlAnimation({target, action, index})`, `IOB.api.animate({…})`,
`IOB.api.controlEffects({target, action})` (mywebui-scripting).

## Group visibility on an element

```html
<div data-visibility-enabled="true" data-visibility-groups="administrator,operators"
     data-visibility-action="hide"></div>   <!-- or "disable"; data-visibility-redirect-screen -->
```
