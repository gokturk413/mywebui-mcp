import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GatewayClient, GatewayError } from '../src/client.js';

function fakeFetch(handler) {
    const calls = [];
    const f = async (url, init = {}) => {
        calls.push({ url: String(url), init });
        const { status = 200, body, text } = await handler(String(url), init, calls.length);
        if (text !== undefined) return new Response(text, { status, headers: { 'content-type': 'text/html' } });
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    };
    f.calls = calls;
    return f;
}

test('logs in with the password grant, then calls the gateway with the bearer token', async () => {
    const f = fakeFetch((url, init) => {
        if (url.endsWith('/oauth/token')) return { body: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } };
        return { body: { ok: true, version: '1.208.0' } };
    });
    const c = new GatewayClient({ url: 'https://scada:8082/', user: 'agent', password: 'pw', fetchImpl: f });
    assert.deepEqual(await c.call('mcpInfo'), { ok: true, version: '1.208.0' });
    const [login, call] = f.calls;
    assert.equal(login.url, 'https://scada:8082/oauth/token');
    const form = new URLSearchParams(login.init.body);
    assert.equal(form.get('grant_type'), 'password');
    assert.equal(form.get('username'), 'agent');
    assert.equal(form.get('password'), 'pw');
    assert.equal(form.get('client_id'), 'ioBroker');
    assert.equal(call.url, 'https://scada:8082/mywebui-api/mcpInfo?ns=mywebui.0');
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers.Authorization, 'Bearer A1');
    assert.equal(call.init.headers['X-Mywebui-Gateway'], '1');
    assert.equal(call.init.headers['Content-Type'], 'application/json');
    assert.equal(call.init.body, '{}');
});

test('a 401 renews the token once with the refresh token and repeats the call', async () => {
    let calls = 0;
    const f = fakeFetch((url, init) => {
        if (url.endsWith('/oauth/token')) {
            const form = new URLSearchParams(init.body);
            return form.get('grant_type') === 'refresh_token'
                ? { body: { access_token: 'A2', refresh_token: 'R2', expires_in: 3600 } }
                : { body: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } };
        }
        calls++;
        return init.headers.Authorization === 'Bearer A2' ? { body: { ok: true } } : { status: 401, body: { error: 'not authenticated' } };
    });
    const c = new GatewayClient({ url: 'http://h:8082', user: 'agent', password: 'pw', fetchImpl: f });
    assert.deepEqual(await c.call('mcpList', { project: 'dev', kind: 'screen' }), { ok: true });
    assert.equal(calls, 2);
});

test('an answer with ok:false becomes a GatewayError with its code', async () => {
    const f = fakeFetch(() => ({ body: { ok: false, code: 'read-only', reason: 'project "plant" is not a dev project' } }));
    const c = new GatewayClient({ url: 'http://h:8082', token: 'T', fetchImpl: f });
    await assert.rejects(c.call('mcpWrite', {}), (e) => e instanceof GatewayError && e.code === 'read-only' && /dev project/.test(e.message));
});

test('HTTP errors, a missing gateway, no credentials', async () => {
    const f404 = fakeFetch(() => ({ status: 404, body: { error: 'unknown command' } }));
    await assert.rejects(new GatewayClient({ url: 'http://h', token: 'T', fetchImpl: f404 }).call('mcpInfo'), (e) => e.code === 'http' && e.status === 404);
    const fBad = fakeFetch((url) => url.endsWith('/oauth/token') ? { status: 400, body: { error: 'invalid_grant' } } : { body: { ok: true } });
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'a', password: 'wrong', fetchImpl: fBad }).call('mcpInfo'), (e) => e.code === 'login');
    // no credentials: web.0 without authentication — call without Authorization
    const fOpen = fakeFetch(() => ({ body: { ok: true } }));
    await new GatewayClient({ url: 'http://h', fetchImpl: fOpen }).call('mcpInfo');
    assert.equal(fOpen.calls[0].init.headers.Authorization, undefined);
});

test('the password never appears in an error (login failure and gateway error)', async () => {
    const PW = 's3cr3t-pw';
    const leaks = (e) => [e.message, String(e), JSON.stringify(e)].some((t) => t.includes(PW));
    // the server echoes the raw request body back in its error text
    const fLogin = fakeFetch((url, init) => ({ status: 401, body: { error: String(init.body) } }));
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'agent', password: PW, fetchImpl: fLogin }).call('mcpInfo'),
        (e) => e.code === 'login' && !leaks(e));
    const fCall = fakeFetch((url, init) => url.endsWith('/oauth/token')
        ? { body: { access_token: 'A1' } }
        : { status: 500, body: { error: String(init.body) } });
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'agent', password: PW, fetchImpl: fCall }).call('mcpInfo', { password: PW }),
        (e) => e.code === 'http' && !leaks(e));
});

test('a 2xx answer that is not JSON is an http error', async () => {
    const f = fakeFetch(() => ({ text: '<html>login</html>' }));
    await assert.rejects(new GatewayClient({ url: 'http://h', token: 'T', fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'http' && e.status === 200 && /not JSON/.test(e.message));
});

test('a network failure becomes a network error without secrets', async () => {
    const f = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(new GatewayClient({ url: 'http://scada:8082', user: 'a', password: 'pw-x', fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'network' && /scada:8082 unreachable: fetch failed/.test(e.message) && !e.message.includes('pw-x'));
    await assert.rejects(new GatewayClient({ url: 'http://scada:8082', token: 'T', fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'network' && e.message.startsWith('mcpInfo:'));
});

test('a timeout becomes a timeout error', async () => {
    const f = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    await assert.rejects(new GatewayClient({ url: 'http://h', token: 'T', callTimeoutMs: 20, fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'timeout');
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'a', password: 'p', loginTimeoutMs: 20, fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'timeout');
});
