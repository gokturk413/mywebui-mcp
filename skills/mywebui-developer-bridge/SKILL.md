---
name: mywebui-developer-bridge
description: Use when writing or debugging a tool that frames and drives the mywebui designer (VS Code extension, agent, test harness) through the mywebui-dev postMessage bridge - hello/welcome pairing, openControl, testControl, createControl, updateControlSource, openWidget, saveTheme, layouts, events; or when the bridge answers refused, reload-required, already-defined, dirty or other-project.
---

# mywebui developer bridge

The designer, framed in an iframe, talks to its parent over `postMessage`. It is off by default
(Admin → mywebui → Developer → **Developer bridge**; *Allowed framing pages*, default
`vscode-webview://`). Leave it off on production servers.

## Pairing

1. Frame `…/mywebui/index.html#mywebui-dev=<token>` (32–128 chars base64url, chosen by the tool).
2. The designer sends `hello {designerVersion, project, user, readOnly, capabilities[]}`.
3. The tool answers `welcome` (`replyTo` = hello's id, optional `{layout}`). The user is asked to
   allow it; `result {layout}` or `error {code:'refused'}`.
4. Every message: `{ns:'mywebui-dev', v:1, type, id, replyTo?, token, payload}`; requests get
   `result` or `error {code, message}`. Anything else is dropped silently.

## Requests

| Request | Payload → result |
|---|---|
| `listProjects` / `listDocuments` | `{}` / `{kind, scope?, project?}` → `{items}` |
| `openControl` / `reloadControl` | `{name, scope:'project'\|'global', kind:'control'\|'3dcontrol', project?, force?}` |
| `openScreen` | `{name, kind?:'screen'\|'3dscreen'\|'report'}` |
| `createControl` | `{name, scope, source:{html, style, script, properties, settings, translations?}}`; `exists` if taken |
| `getControlSource` / `updateControlSource` | read incl. unsaved changes / push `style`, `script` (≤ 1 MB); `script-error` with line |
| `testControl` | `{name, scope, source?}` → `{tag}`: test without saving (`webui-vscode-test-<name>`) |
| `saveDocument` | `{}` or `{name, kind, scope}`: the designer's own save |
| `selectElement` | `{elementId}` or `{path:'0/3/1'}` → `{found}` |
| `openWidget` | `{module:'/__mywebui-dev/widgets/<pkg>/dist/index.js', element, customElements?, translations?, importMap?}` |
| `listThemes` / `previewTheme` / `saveTheme` / `deleteTheme` | Global Style themes |
| `listLanguages` / `setLanguage` | languages, `{lang}` |
| `setLayout` | `{profile:'vscode'\|'control'\|'widget'\|'full'}` |
| `diagnostics`, `ping`, `reload`, `disconnect` | |

Events: `documentChanged`, `selectionChanged`, `controlSaved`, `screenSaved`, `documentsChanged`,
`controlSourceChanged`, `languageChanged`, `widgetTranslationsChanged`, `error`, `bye`.

## Errors to handle

| Code | Do |
|---|---|
| `refused` | the user said no; stop |
| `reload-required` | send `reload`, wait for the new `hello`, send `openWidget` again |
| `already-defined` | an installed package owns the tag: rename the element |
| `dirty` | the user has unsaved changes: ask, then `force` |
| `exists`, `not-found`, `other-project`, `forbidden`, `license-restricted`, `bad-payload`, `script-error`, `import-failed`, `not-defined` | report them to the user |

## Proxy rules

Forward `/socket.io/` WebSocket upgrades with the session cookie; keep every `Set-Cookie`
(`/login`, `/oauth/token`, `/mywebui-api/renewToken`); fixed port (localStorage is per origin);
pass `X-Mywebui-Gateway`, `Content-Type`, `Sec-Fetch-*` unchanged; never add `X-Forwarded-For`.

Full protocol: `docs/developer-bridge.md`.
