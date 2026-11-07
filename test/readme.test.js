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

test('CI: Node 20, 22, 24, read-only token; the package publishes as public', () => {
    assert.match(ci, /node: \[20, 22, 24\]/);
    assert.match(ci, /permissions: \{ contents: read \}/);
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.deepEqual(pkg.publishConfig, { access: 'public' });
});

test('the README: how the secret reaches the server, and what a write does not do', () => {
    assert.match(readme, /env_vars = \[[^\]]*"MYWEBUI_PASSWORD"/);
    assert.match(readme, /NODE_EXTRA_CA_CERTS[^\n]*env_vars|env_vars[^\n]*NODE_EXTRA_CA_CERTS/);
    assert.ok(readme.includes('~/.claude.json'));
    assert.match(readme, /about an hour/);
    assert.ok(!readme.includes('scada:8082'));
    assert.ok(readme.includes('https://scada:9090'));
    for (const s of ['authentication', '6 MiB', 'client_max_body_size', 'finding', 'designer']) assert.ok(readme.includes(s), s);
});

test('LICENSE: only this package', () => {
    const lic = fs.readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
    assert.ok(!/iobroker\.webui|www\/libs|@node-projects|MIT License/.test(lic));
    assert.ok(lic.includes('Attribution-NonCommercial 4.0 International'));
    assert.ok(lic.startsWith('@gokturk413/mywebui-mcp'));
});
