import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const ci = fs.readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');

test('the README names every tool, every variable and the admin switch', () => {
    for (const t of ['mywebui_info', 'mywebui_list', 'mywebui_read', 'mywebui_validate', 'mywebui_write', 'mywebui_create_project', 'mywebui_search_states', 'mywebui_guide']) assert.ok(readme.includes(t), t);
    for (const v of ['MYWEBUI_URL', 'MYWEBUI_USER', 'MYWEBUI_PASSWORD', 'MYWEBUI_TOKEN', 'MYWEBUI_INSTANCE', 'NODE_EXTRA_CA_CERTS']) assert.ok(readme.includes(v), v);
    for (const s of ['AI agents (MCP)', 'claude mcp add', 'settings.json', 'config.toml']) assert.ok(readme.includes(s), s);
});

test('CI runs only on GitHub-hosted runners (public repository)', () => {
    assert.ok(!/self-hosted|scada-win|scada-linux/.test(ci));
    assert.match(ci, /runs-on: ubuntu-latest/);
});
