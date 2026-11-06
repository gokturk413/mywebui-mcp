import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { loadSkills } from '../src/skills.js';
import { GatewayError } from '../src/client.js';

async function connect(answers) {
    const calls = [];
    const client = { call: async (cmd, body) => { calls.push([cmd, body]); const a = answers[cmd]; if (a instanceof Error) throw a; return a ?? { ok: true }; } };
    const server = createServer({ client, skills: loadSkills(new URL('../skills/', import.meta.url)), version: '0.1.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(a), mcp.connect(b)]);
    return { mcp, calls };
}
const text = (r) => r.content.map(c => c.text).join('\n');

test('the tools are there', async () => {
    const { mcp } = await connect({});
    const names = (await mcp.listTools()).tools.map(t => t.name).sort();
    assert.deepEqual(names, ['mywebui_create_project', 'mywebui_guide', 'mywebui_info', 'mywebui_list', 'mywebui_read', 'mywebui_search_states', 'mywebui_validate', 'mywebui_write']);
});

test('tools call the adapter commands with their arguments', async () => {
    const { mcp, calls } = await connect({ mcpRead: { ok: true, content: { html: 'x' }, sha256: 'ab' } });
    const r = await mcp.callTool({ name: 'mywebui_read', arguments: { kind: 'screen', name: 'start' } });
    assert.deepEqual(calls[0], ['mcpRead', { kind: 'screen', name: 'start', project: 'default' }]);
    assert.deepEqual(JSON.parse(text(r)), { ok: true, content: { html: 'x' }, sha256: 'ab' });
    await mcp.callTool({ name: 'mywebui_write', arguments: { project: 'dev', kind: 'control', name: 'a/b', content: '{"html":""}', baseSha256: 'cd' } });
    assert.deepEqual(calls[1], ['mcpWrite', { project: 'dev', kind: 'control', name: 'a/b', content: '{"html":""}', baseSha256: 'cd' }]);
    await mcp.callTool({ name: 'mywebui_search_states', arguments: { pattern: '0_userdata.0.*' } });
    assert.deepEqual(calls[2], ['mcpStates', { pattern: '0_userdata.0.*' }]);
});

test('a refusal comes back as a tool error with its code', async () => {
    const { mcp } = await connect({ mcpWrite: new GatewayError('read-only', 'project "plant" is not a dev project') });
    const r = await mcp.callTool({ name: 'mywebui_write', arguments: { project: 'plant', kind: 'screen', name: 's', content: '{}' } });
    assert.equal(r.isError, true);
    assert.match(text(r), /^read-only: project "plant" is not a dev project/);
});

test('the guide lists skills and reads them; skills are resources', async () => {
    const { mcp, calls } = await connect({});
    assert.match(text(await mcp.callTool({ name: 'mywebui_guide', arguments: {} })), /mywebui-custom-controls/);
    assert.match(text(await mcp.callTool({ name: 'mywebui_guide', arguments: { skill: 'mywebui-theming' } })), /--ui-surface/);
    const bad = await mcp.callTool({ name: 'mywebui_guide', arguments: { skill: 'nope' } });
    assert.equal(bad.isError, true);
    assert.equal(calls.length, 0);
    const res = (await mcp.listResources()).resources;
    assert.ok(res.some(r => r.uri === 'mywebui-skill://mywebui-development/SKILL.md'));
    const body = await mcp.readResource({ uri: 'mywebui-skill://mywebui-bindings/reference.md' });
    assert.match(body.contents[0].text, /Bindings: reference/);
});
