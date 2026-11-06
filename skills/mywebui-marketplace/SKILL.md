---
name: mywebui-marketplace
description: Use when packaging mywebui custom controls, npm widgets or themes as a .mwpkg, writing its manifest.json, signing it, publishing it to the mywebui marketplace registry (GitHub topic mywebui-package), selling it with licence keys (mwl1.…), or when an install is refused (sha256, signature, manifest, scan finding, licence-*).
---

# mywebui marketplace packages

A package is a zip named `<name>-<version>.mwpkg` holding `manifest.json` and exactly the files
the manifest lists. The mywebui VS Code extension creates, validates, builds, signs and publishes
them; do it by hand only when you must.

## manifest.json (schema 1)

```json
{ "schema": 1, "id": "ahmadov/pump-isa", "name": "Pump symbol ISA", "version": "1.2.0",
  "kind": "control", "mywebui": ">=1.206",
  "author": { "name": "Ahmadov Automation", "github": "ahmadov" },
  "license": { "type": "free", "spdx": "MIT" },
  "files": [ { "path": "controls/pump.control", "sha256": "<hex>" }, { "path": "preview.svg", "sha256": "<hex>" } ],
  "preview": "preview.svg",
  "uses": { "writes": false, "sendTo": [], "network": false },
  "tags": ["pump", "isa"], "description": { "en": "ISA pump symbol", "az": "ISA nasos simvolu" } }
```

| `kind` | Content |
|---|---|
| `control` | `controls/<path>.control` (control fields only, known property types, no `debugger;`) |
| `npm-widget` | `"npm": {"package", "version", "tarball"?}`; with `tarball` (the `npm pack` file, listed in `files`) no npm account is needed |
| `theme` | `themes/<name>.css`, one rule `html[data-webui-theme="<name>"]{…}` of `color-scheme`, `--ui-*`, `--accent` only |

- `id` = `<github owner>/<name>`; the owner's key signs it. Controls install as `market/<owner>/<name>/…`.
- `uses` must match what the code does: the scan compares them.
- Previews: SVG (no script, events, animation, entities, external links) or PNG, ≤ 200 KB.
- `listed: false` in the index entry keeps it out of every index (default `true`).

## Signing

```js
const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest();
const sig = crypto.sign(null, digest, privateKey).toString('base64');   // Ed25519 over the 32-byte digest
```

The public key (base64 of its 32 raw bytes) is published as `mywebui-key.pub` in the package's
repository and appears in the registry as `keys.<owner> = "ed25519:<base64>"`. Keep the private key
out of every repository.

## Publishing (community registry)

Make the GitHub repository public with the topic **`mywebui-package`**, add `mywebui-key.pub`,
and attach `entry.json` (the index entry) and the `.mwpkg` to a release. The registry
(gokturk413/mywebui-marketplace) discovers it hourly, verifies hash and signature, scans the code
and lists it. A **high** scan finding waits for a maintainer's `scanAccepted: "<sha256>"`.

## Commercial packages

Entry: `license: { type: "commercial", price: "€49 / site", buyUrl: "https://…", trialDays?, models? }`.
The buyer sends the **Installation ID** (ioBroker `system.meta.uuid`); the author signs a key
(VS Code: *Issue Licence…*):

```
mwl1.<base64url payload JSON>.<base64url Ed25519 signature of the base64url payload text>
payload: { v:1, pkg, licensee, issued, scope: {kind:'project', installation, project}
           | {kind:'installations', installations:[…]} | {kind:'developer'},
           versions?: "1" | "1.2", expires?: "YYYY-MM-DD" }
```

Checked at install by `mywebui.0` against the owner key. Trials (`trialDays`) exist for themes only,
once per installation. It keeps honest customers honest; it is not DRM.

## Install refusals

| Code / message | Cause |
|---|---|
| sha256 mismatch | the file is not the one the index lists |
| signature | not signed by the owner's registry key |
| manifest | id/version/kind/licence differ from the entry, or a file is unlisted |
| `license-required`, `license-bad`, `license-other-installation`, `license-other-project`, `license-version`, `license-expired`, `license-trial-over` | commercial key problems |

From a file: Gallery → Marketplace → **From file…** (Admin switch *Allow packages from files*;
the administrator takes the responsibility; journaled).

Full guide: `docs/marketplace.md`.
