// The binary itself: configuration errors end it with exit 2, a good configuration serves the tools
// without contacting web.0 (the login waits for the first call).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/mywebui-mcp.js', import.meta.url));
const envWith = (vars) => {
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('MYWEBUI_')) delete env[k];
    return { ...env, ...vars };
};
function run(vars) {
    return new Promise((resolve) => {
        const p = spawn(process.execPath, [BIN], { env: envWith(vars), stdio: ['ignore', 'pipe', 'pipe'] });
        let err = '';
        p.stderr.on('data', (d) => { err += d; });
        p.on('close', (code) => resolve({ code, err }));
    });
}

test('a configuration error: its message, exit 2, no secret', async () => {
    let r = await run({});
    assert.equal(r.code, 2);
    assert.match(r.err, /MYWEBUI_URL/);
    r = await run({ MYWEBUI_URL: 'http://u:s3cret@scada:8082' });
    assert.equal(r.code, 2);
    assert.ok(!r.err.includes('s3cret'), r.err);
    r = await run({ MYWEBUI_URL: 'http://scada:8082' });
    assert.equal(r.code, 2);
    assert.match(r.err, /MYWEBUI_TOKEN/);
    r = await run({ MYWEBUI_URL: 'http://scada:8082', MYWEBUI_USER: 'a' });
    assert.equal(r.code, 2);
});

test('initialize and tools/list answer without any request to web.0', async () => {
    let requests = 0;
    const web = http.createServer((req, res) => { requests++; res.statusCode = 500; res.end(); });
    await new Promise(r => web.listen(0, '127.0.0.1', r));
    const p = spawn(process.execPath, [BIN], {
        env: envWith({ MYWEBUI_URL: 'http://127.0.0.1:' + web.address().port, MYWEBUI_USER: 'agent', MYWEBUI_PASSWORD: 'pw' }),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    try {
        const answers = new Map();
        let buf = '';
        const waiting = new Map();
        p.stdout.on('data', (d) => {
            buf += d;
            for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) {
                const m = JSON.parse(buf.slice(0, i));
                answers.set(m.id, m);
                waiting.get(m.id)?.(m);
            }
        });
        const ask = (id, method, params) => new Promise((resolve, reject) => {
            p.once('close', (code) => reject(new Error('the binary ended with ' + code)));
            waiting.set(id, resolve);
            p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        });
        const init = await ask(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
        assert.equal(init.result.serverInfo.name, 'mywebui');
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        const list = await ask(2, 'tools/list', {});
        assert.equal(list.result.tools.length, 8);
        assert.equal(requests, 0);
    } finally {
        p.kill();
        await new Promise(r => web.close(r));
    }
});
