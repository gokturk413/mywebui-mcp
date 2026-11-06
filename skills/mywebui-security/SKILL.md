---
name: mywebui-security
description: Use when restricting who may see a mywebui screen or element or write a value - security.json roles/areas/actions (PlantPAx style), IOB.secCan, IOB.secWriteState, data-area, data-action, group visibility, screen access, Confirm & Protect (data-confirm, password writes, supervisor approval), ioBroker group rights and object ACLs; or when a write is denied, a button should be hidden for operators, or a sendTo silently does nothing.
---

# mywebui security

UI hiding is convenience; the walls are on the server. Use the layers together:

| Layer | Does | Bypassable from the browser |
|---|---|---|
| `IOB.secCan` / group visibility in the UI | hide / disable | yes (UX only) |
| ioBroker session rights + object ACL | every read / write of the logged-in user | no |
| `IOB.secWriteState` | the server re-checks the role/area matrix, stamps identity | no |
| Confirm & Protect (password) | the server checks the user's password and the rule | no |

## The model: `<project>/data/security.json`

```json
{ "codes": { "A": "Operator", "B": "Operating Supervisor", "E": "Engineering", "G": "Admin" },
  "actions": { "operate": { "codes": "ABEG", "level": "basic" },
               "setpointOverride": { "codes": "BEG", "level": "basic" },
               "configure": { "codes": "EG", "level": "advanced" } },
  "areas": { "Area01": {} },
  "users": { "operator": { "code": "A", "areas": { "Area01": "basic" } },
             "admin": { "code": "G", "areas": { "*": "advanced" } } },
  "defaultAllow": false }
```

No file → everything allowed. Unknown action → allowed. Unknown user → denied unless
`defaultAllow`. `advanced` actions need the area at `advanced`. Special actions: `diagnostics`
(state details panel), `supervisorApprove`, `messages`.

## In controls and scripts

```html
<section data-area="Area01"> … <button data-action="setpointOverride">…</button></section>
<button css:display="[[window.IOB?.secCan?.('configure', this) ? '' : 'none']]">Configure</button>
```

```js
if (!IOB.secCan('setpointOverride', instance)) hide(instance);          // re-check on IOB.securityChanged
const res = await IOB.secWriteState('0_userdata.0.sp', 55, { action: 'setpointOverride', element: instance });
if (!res.ok) console.warn(res.reason);                                   // 'permission denied', 'acl-denied', …
const a = await IOB.access('0_userdata.0.sp');                           // { read, write, reasonRead?, reasonWrite? }
```

Simple Script and `IOB.api` check `data-action` + area, screen access and ioBroker rights before
each command (mywebui-scripting).

## Visibility and screen access

- Element: `data-visibility-enabled="true" data-visibility-groups="administrator,operators"
  data-visibility-action="hide|disable" data-visibility-redirect-screen="…"`.
- Screen: `settings.accessibility` + `visibility*`; checked by the server (`checkScreenAccess`)
  through the web.0 gateway.
- Reports render for a user with the same visibility.

## Confirm & Protect

The element attribute `data-confirm` holds the rule: **Confirm** (yes/no with old → new),
**Choice** (a button per value), **Password** (checked on the server, `sendTo protectedWrite`
via the gateway; rule in `<project>/data/protected.json`). Placeholders in title / message:
`{control} {stateId} {oldValue} {newValue} {oldText} {newText} {user}`, `t:key`. The dialog is the
control `dialog/confirm-dialog` (property `request`, event `dialog-result`). For a hard boundary
use *Restrict writes in ioBroker (ACL)*. A write cancelled by the dialog resolves
`whenWriteConfirmed` with `status: 'cancelled'`.

## Common mistakes

| Mistake | Fix |
|---|---|
| hiding a button and calling it secure | also restrict the state (ACL / secWriteState) |
| trusting a `username` in a `sendTo` payload | identity comes from the session (gateway) |
| operators in the `administrator` group | keep them out: *Restrict writes in ioBroker* leaves states writable for administrators |
| `alert()`-based permission checks | the runtime already shows a notice and `{denied:true}` |

Full guides: `docs/permissions.md`, `docs/confirm-protect.md`.
