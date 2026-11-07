# mywebui-mcp

An [MCP](https://modelcontextprotocol.io) server for **mywebui**, the ioBroker SCADA/HMI
visualisation. AI coding agents (Claude Code, Gemini CLI, OpenAI Codex, …) use it to list, read,
check, create and update screens, custom controls and reports on a running ioBroker, to create
projects, and to look up states to bind. It also gives the agent the mywebui development skills.

## On the ioBroker side

mywebui ≥ 1.208.0. Admin → mywebui instance → **AI agents (MCP)**:

- **Allow AI agents (MCP)**: off by default.
- **Dev projects (AI agents may write)**, e.g. `dev, agent-test`. Every other project is read-only.
- **Allow AI agents to create projects**: off by default.

Make a separate ioBroker **administrator** user for agents. The server signs in to web.0 with it.
web.0 needs authentication switched on; without it, every call is refused. Behind a proxy, allow
request bodies of 6 MiB (nginx: `client_max_body_size`; its default of 1 MiB answers 413).

No MCP command writes a state. Every write keeps the previous file in `<project>/data/.mcp-backup/`
(the newest 10 per document) and is recorded in the mywebui journal.

## What `mywebui_write` does not do

- Code in a written screen or control can write states with the rights of whoever opens the page. Script
  calls, two-way bindings and Simple Script write commands come back as a warning in the findings, not a
  refusal, so write only to dev projects and review the code before it goes to a plant project. The scan
  is a text heuristic and not a proof: a script that builds its call dynamically can escape it.
- An open designer tab does not reload the write, and a later save there overwrites it. Runtime pages of
  that project refresh; closed documents pick it up when opened.
- A report's output, schedule and trigger can only be set in the designer. A screen stays out of the
  multi-view index, and a control has no thumbnail, until it is saved in the designer.

## Configuration

| Variable | |
|---|---|
| `MYWEBUI_URL` | web.0's address, or a cluster's address, e.g. `https://scada:9090` (required). No credentials in it |
| `MYWEBUI_USER`, `MYWEBUI_PASSWORD` | the agents' administrator user |
| `MYWEBUI_TOKEN` | instead of user and password: an OAuth2 access token. It lasts about an hour and is not renewed |
| `MYWEBUI_INSTANCE` | the mywebui instance, default `mywebui.0` |
| `NODE_EXTRA_CA_CERTS` | path to web.0's certificate when it is self-signed |

The server stops at start (exit code 2) when the address is unusable or there are no credentials.
After a refused login (HTTP 400 or 401 from web.0) it does not try again for 60 seconds, because web.0 locks a user after repeated failures.

Keep the password in the agent's environment or secret store, never in a repository.

## Connect an agent

Claude Code:

```bash
claude mcp add mywebui -e MYWEBUI_URL=https://scada:9090 -e MYWEBUI_USER=agent -e MYWEBUI_PASSWORD="$MYWEBUI_PASSWORD" -- npx -y @gokturk413/mywebui-mcp
```

`-e` stores the value in Claude's configuration file (`~/.claude.json`) in plain text, so use a dedicated
agents' user whose password you can change.

Gemini CLI, `~/.gemini/settings.json`:

```json
{ "mcpServers": { "mywebui": { "command": "npx", "args": ["-y", "@gokturk413/mywebui-mcp"],
  "env": { "MYWEBUI_URL": "https://scada:9090", "MYWEBUI_USER": "agent", "MYWEBUI_PASSWORD": "$MYWEBUI_PASSWORD" } } } }
```

OpenAI Codex, `~/.codex/config.toml`:

```toml
[mcp_servers.mywebui]
command = "npx"
args = ["-y", "@gokturk413/mywebui-mcp"]
env = { MYWEBUI_URL = "https://scada:9090", MYWEBUI_USER = "agent" }
env_vars = ["MYWEBUI_PASSWORD"]
```

`env_vars` forwards the variable from the environment that starts Codex; exporting it alone does not
reach the server. `NODE_EXTRA_CA_CERTS` needs the same: `env_vars = ["MYWEBUI_PASSWORD", "NODE_EXTRA_CA_CERTS"]`.

## Tools

| Tool | Does |
|---|---|
| `mywebui_info` | version, projects and which are writable; call it first |
| `mywebui_list` | screens, controls or reports of a project (global controls with `scope: global`) |
| `mywebui_read` | one document's JSON and its `sha256` |
| `mywebui_validate` | checks and scans a document, writes nothing |
| `mywebui_write` | creates or replaces a document in a dev project (`baseSha256` guards against overwriting a newer file) |
| `mywebui_create_project` | an empty project, when allowed |
| `mywebui_search_states` | states matching a pattern that begins with an adapter and instance: id, name, type, role, unit, writable |
| `mywebui_guide` | the mywebui skills: list, a skill, or one of its files |

The skills are also resources: `mywebui-skill://<skill>/<file>`.

## Licence

CC BY-NC 4.0, see [LICENSE](LICENSE).
