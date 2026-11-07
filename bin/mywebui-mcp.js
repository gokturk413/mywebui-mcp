#!/usr/bin/env node
// mywebui MCP server over stdio. Configuration from the environment:
//   MYWEBUI_URL       web.0's address, e.g. https://scada:9090 (required, no credentials in it)
//   MYWEBUI_USER      an ioBroker administrator for agents
//   MYWEBUI_PASSWORD  its password (keep it in the agent's environment, never in a repository)
//   MYWEBUI_TOKEN     instead of user + password: an OAuth2 access token (about an hour, not renewed)
//   MYWEBUI_INSTANCE  mywebui instance, default mywebui.0
// A self-signed web.0 certificate: point NODE_EXTRA_CA_CERTS at it.
import fs from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GatewayClient, GatewayError } from '../src/client.js';
import { createServer } from '../src/server.js';
import { loadSkills } from '../src/skills.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const env = process.env;
let client;
try {
    client = new GatewayClient({ url: env.MYWEBUI_URL, user: env.MYWEBUI_USER, password: env.MYWEBUI_PASSWORD, token: env.MYWEBUI_TOKEN, instance: env.MYWEBUI_INSTANCE || 'mywebui.0' });
} catch (e) {
    if (e instanceof GatewayError && e.code === 'config') { console.error('mywebui-mcp: ' + e.message); process.exit(2); }
    throw e;
}
const server = createServer({ client, skills: loadSkills(new URL('../skills/', import.meta.url)), version });
await server.connect(new StdioServerTransport());
console.error(`mywebui-mcp ${version}: ${env.MYWEBUI_URL}`);
