---
name: mywebui-server-scripts
description: Use when writing JavaScript that runs on the mywebui server (Designer → Server Scripts) - reacting to ioBroker state changes, schedules (cron), writing states, sendTo another adapter, http calls, generating reports, shared modules, npm libraries; or when a server script is stopped, times out, runs out of memory or a library is refused.
---

# mywebui server scripts

A server script runs in the `mywebui.0` adapter all the time, in its own QuickJS sandbox (no Node,
no disk, no network except `http.*` to allowed hosts). Only administrators write and save them;
a script acts with the adapter's rights. Top-level `await` works.

## API

| Call | Does |
|---|---|
| `on(id \| pattern \| {id, change, ack, val}, cb)` | `cb(state, id, old)`; `change`: `ne` (default), `any`, `gt`, `lt`, `eq`; `*` patterns. Alias `subscribe` |
| `unsubscribe(handle)` | |
| `await getState(id)` / `getStates(pattern)` | `{val, ack, ts, lc, q, from, user}` or `null` / `{[id]: state}` |
| `await setState(id, val, { ack })` | `ack:false` (default) = a command the driver confirms |
| `await setStateChanged(id, val, opts)` | only when different |
| `getObject(id)`, `getObjects(pattern)` | |
| `await createState(id, common, initial)` | only under `0_userdata.0.` and `mywebui.0.scripts.<project>.` |
| `schedule('min hour day month weekday', cb)`, `clearSchedule` | plant time zone |
| `setTimeout`, `setInterval`, `clear*` | removed when the script stops |
| `await sendTo(instance, command, message)` | answer within 30 s |
| `await http.get(url)`, `http.post(url, body)` | hosts from Settings → Server Scripts → Allowed hosts; 10 s, 1 MB, no redirects |
| `await report.generate(name, { format })` | → `{ok, file, error}` |
| `log.info / warn / error / debug` | script Log + ioBroker log |
| `onStop(cb)` | cleanup before stop / save / restart (≤ 2 s) |

```js
const LEVEL = 'modbus.0.holdingRegisters.40001_tank_level', PUMP = 'modbus.0.coils.1_pump1';
on({ id: LEVEL, ack: true }, async (st) => {
  const running = (await getState(PUMP))?.val;
  if (st.val > 80 && !running) await setState(PUMP, true);
  else if (st.val < 20 && running) await setState(PUMP, false);
});
schedule('0 6,14,22 * * *', async () => {
  const r = await report.generate('reports/shift', { format: 'pdf' });
  log.info(r.ok ? `written: ${r.file}` : `failed: ${r.error}`);
});
```

## Modules and libraries

- **+ Module** → `common/<name>.js`, imported as `import { x } from 'common/limits.js'`.
  Saving it restarts the project's running scripts.
- **Libraries**: an npm name (`dayjs`, `lodash-es@4`) is downloaded and bundled once (≤ 2 MB).
  Plain JavaScript only; anything needing Node (`fs`, `net`, native modules) is refused; use an
  adapter through `sendTo` instead.

## Limits

Handler time 500 ms per run, memory 32 MB, 600 writes per minute (Settings → Server Scripts,
per script). On error: log and go on (default), stop, or restart after 30 s.
States: `mywebui.0.scripts.<project>.<folder>.<name>.status|lastError|since|control`
(`start`, `stop`, `restart`). Writes are journaled as `script:<project>/<name>`.

## Common mistakes

| Mistake | Fix |
|---|---|
| `require('fs')`, `fetch(...)` | not in the sandbox: `sendTo` an adapter, `http.get` |
| `on(id, …)` reacting to its own command echo | filter `{ ack: true }` for driver values |
| busy loop / heavy sync work | split with timers; 500 ms per run |
| `createState('javascript.0.x', …)` | only `0_userdata.0.*` or `mywebui.0.scripts.<project>.*` |
| writing every cycle | `setStateChanged` |

Full guide: `docs/server-scripts.md`.
