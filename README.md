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
mywebui never lets the MCP write a state. Every write keeps the previous file in
`<project>/data/.mcp-backup/` and is recorded in the mywebui journal.

## Configuration

| Variable | |
|---|---|
| `MYWEBUI_URL` | web.0's address, e.g. `https://scada:8082` (required) |
| `MYWEBUI_USER`, `MYWEBUI_PASSWORD` | the agents' administrator user |
| `MYWEBUI_TOKEN` | instead of user and password: an OAuth2 access token |
| `MYWEBUI_INSTANCE` | the mywebui instance, default `mywebui.0` |
| `NODE_EXTRA_CA_CERTS` | path to web.0's certificate when it is self-signed |

Keep the password in the agent's environment or secret store, never in a repository.

## Connect an agent

Claude Code:

```bash
claude mcp add mywebui -e MYWEBUI_URL=https://scada:8082 -e MYWEBUI_USER=agent -e MYWEBUI_PASSWORD="$MYWEBUI_PASSWORD" -- npx -y @gokturk413/mywebui-mcp
```

Gemini CLI, `~/.gemini/settings.json`:

```json
{ "mcpServers": { "mywebui": { "command": "npx", "args": ["-y", "@gokturk413/mywebui-mcp"],
  "env": { "MYWEBUI_URL": "https://scada:8082", "MYWEBUI_USER": "agent", "MYWEBUI_PASSWORD": "$MYWEBUI_PASSWORD" } } } }
```

OpenAI Codex, `~/.codex/config.toml`:

```toml
[mcp_servers.mywebui]
command = "npx"
args = ["-y", "@gokturk413/mywebui-mcp"]
env = { MYWEBUI_URL = "https://scada:8082", MYWEBUI_USER = "agent" }
# MYWEBUI_PASSWORD: export it in the shell that starts codex
```

## Tools

| Tool | Does |
|---|---|
| `mywebui_info` | version, projects and which are writable; call it first |
| `mywebui_list` | screens, controls or reports of a project (global controls with `scope: global`) |
| `mywebui_read` | one document's JSON and its `sha256` |
| `mywebui_validate` | checks and scans a document, writes nothing |
| `mywebui_write` | creates or replaces a document in a dev project (`baseSha256` guards against overwriting a newer file) |
| `mywebui_create_project` | an empty project, when allowed |
| `mywebui_search_states` | states matching a pattern: id, name, type, role, unit, writable |
| `mywebui_guide` | the mywebui skills: list, a skill, or one of its files |

The skills are also resources: `mywebui-skill://<skill>/<file>`.

## Licence

CC BY-NC 4.0, see [LICENSE](LICENSE).
