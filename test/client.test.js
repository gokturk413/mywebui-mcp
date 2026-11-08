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

test('HTTP errors, a refused login', async () => {
    const f404 = fakeFetch(() => ({ status: 404, body: { error: 'unknown command' } }));
    await assert.rejects(new GatewayClient({ url: 'http://h', token: 'T', fetchImpl: f404 }).call('mcpInfo'), (e) => e.code === 'http' && e.status === 404);
    const fBad = fakeFetch((url) => url.endsWith('/oauth/token') ? { status: 400, body: { error: 'invalid_grant' } } : { body: { ok: true } });
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'a', password: 'wrong', fetchImpl: fBad }).call('mcpInfo'), (e) => e.code === 'login');
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
    // a request that never answers; like a real socket it keeps the event loop alive (the timer of
    // AbortSignal.timeout does not, so without this Node 22 ends the test before the abort fires)
    const f = (url, init) => new Promise((_, reject) => {
        const socket = setInterval(() => { }, 1000);
        init.signal.addEventListener('abort', () => { clearInterval(socket); reject(init.signal.reason); });
    });
    await assert.rejects(new GatewayClient({ url: 'http://h', token: 'T', callTimeoutMs: 20, fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'timeout');
    await assert.rejects(new GatewayClient({ url: 'http://h', user: 'a', password: 'p', loginTimeoutMs: 20, fetchImpl: f }).call('mcpInfo'),
        (e) => e.code === 'timeout');
});

// --- final review ---------------------------------------------------------------------------
const tick = () => new Promise(setImmediate);

test('P1 a gateway answer without ok:true is a failure', async () => {
    const answer = (body) => new GatewayClient({ url: 'http://h', token: 'T', fetchImpl: fakeFetch(() => ({ body })) }).call('mcpInfo');
    await assert.rejects(answer({ error: 'no answer from mywebui.0' }), (e) => e instanceof GatewayError && e.code === 'failed' && e.message === 'no answer from mywebui.0');
    await assert.rejects(answer({}), (e) => e.code === 'failed' && e.message === 'refused');
    await assert.rejects(answer({ ok: 1 }), (e) => e.code === 'failed');
    await assert.rejects(answer({ reason: 'session-blocked', sessionBlocked: true }), (e) => e.code === 'failed' && e.message === 'session-blocked');
    await assert.rejects(answer({ error: 'token T leaked' }), (e) => e.code === 'failed' && !e.message.includes(' T '), 'scrubbed');
});

test('P2 a bad URL is refused at construction and not quoted', () => {
    const make = (url) => new GatewayClient({ url, user: 'a', password: 'p' });
    const refused = (url, secret) => assert.throws(() => make(url), (e) => e instanceof GatewayError && e.code === 'config' && (!secret || !e.message.includes(secret)), url);
    refused(undefined);
    refused('http://u:s3cret@scada:8082', 's3cret');
    refused('http://u:s3cret@scada:8082', 'u:');
    refused('https://onlyuser@scada', 'onlyuser');
    refused('ftp://scada:21');
    refused('file:///etc/passwd');
    refused('not a url at s3cret', 's3cret');
    refused('scada:8082');
    refused('http://scada:8082/?token=s3cret', 's3cret');
    refused('http://scada:8082/#s3cret', 's3cret');
});

test('P2 credentials: a user needs a password; none at all is refused', () => {
    const says = (e) => e.code === 'config' && /MYWEBUI_USER/.test(e.message) && /MYWEBUI_PASSWORD/.test(e.message) && /MYWEBUI_TOKEN/.test(e.message);
    assert.throws(() => new GatewayClient({ url: 'http://h' }), says);
    assert.throws(() => new GatewayClient({ url: 'http://h', user: 'a' }), says);
    assert.throws(() => new GatewayClient({ url: 'http://h', password: 'p' }), says);
    assert.throws(() => new GatewayClient({ url: 'http://h', user: 'a', token: 'T' }), says);
    assert.ok(new GatewayClient({ url: 'http://h', token: 'T' }));
    assert.ok(new GatewayClient({ url: 'http://h', user: 'a', password: 'p' }));
});

test('P2 a path prefix stays, trailing slashes go', async () => {
    const f = fakeFetch((url) => url.endsWith('/oauth/token') ? { body: { access_token: 'A' } } : { body: { ok: true } });
    await new GatewayClient({ url: 'https://vip/scada/', user: 'a', password: 'p', fetchImpl: f }).call('mcpInfo');
    assert.equal(f.calls[0].url, 'https://vip/scada/oauth/token');
    assert.equal(f.calls[1].url, 'https://vip/scada/mywebui-api/mcpInfo?ns=mywebui.0');
});

test('P3 parallel first calls share one login', async () => {
    const f = fakeFetch(async (url) => { await tick(); return url.endsWith('/oauth/token') ? { body: { access_token: 'A1', refresh_token: 'R1' } } : { body: { ok: true } }; });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f });
    await Promise.all([c.call('mcpInfo'), c.call('mcpInfo'), c.call('mcpInfo')]);
    assert.equal(f.calls.filter(x => x.url.endsWith('/oauth/token')).length, 1);
    for (const x of f.calls.filter(x => !x.url.endsWith('/oauth/token'))) assert.equal(x.init.headers.Authorization, 'Bearer A1');
});

test('P3 parallel 401s share one renewal and all retry with the new token', async () => {
    let refreshes = 0;
    const f = fakeFetch(async (url, init) => {
        await tick();
        if (url.endsWith('/oauth/token')) {
            if (new URLSearchParams(init.body).get('grant_type') === 'password') return { body: { access_token: 'A1', refresh_token: 'R1' } };
            refreshes++;
            await tick();
            return { body: { access_token: 'A2', refresh_token: 'R2' } };
        }
        return init.headers.Authorization === 'Bearer A2' ? { body: { ok: true } } : { status: 401, body: { error: 'not authenticated' } };
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f });
    const rs = await Promise.all([c.call('mcpInfo'), c.call('mcpList'), c.call('mcpRead')]);
    for (const r of rs) assert.equal(r.ok, true);
    assert.equal(refreshes, 1);
    const final = f.calls.filter(x => x.init.headers?.Authorization === 'Bearer A2').map(x => new URL(x.url).pathname).sort();
    assert.deepEqual(final, ['/mywebui-api/mcpInfo', '/mywebui-api/mcpList', '/mywebui-api/mcpRead']);
});

test('P3 a 401 that arrives after the renewal retries without another one', async () => {
    let refreshes = 0, releaseLate;
    const late = new Promise(r => { releaseLate = r; });
    const f = fakeFetch(async (url, init) => {
        if (url.endsWith('/oauth/token')) {
            if (new URLSearchParams(init.body).get('grant_type') === 'password') return { body: { access_token: 'A1', refresh_token: 'R1' } };
            refreshes++;
            return { body: { access_token: 'A2', refresh_token: 'R2' } };
        }
        if (url.includes('/mcpList') && init.headers.Authorization === 'Bearer A1') { await late; return { status: 401, body: {} }; }
        return init.headers.Authorization === 'Bearer A2' ? { body: { ok: true } } : { status: 401, body: {} };
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f });
    const slow = c.call('mcpList');
    const fast = c.call('mcpInfo');
    await fast;
    releaseLate();
    assert.equal((await slow).ok, true);
    assert.equal(refreshes, 1);
});

test('P4 after a refused login no call reaches web.0 for 60 s', async () => {
    let t = 1000, accept = false;
    const f = fakeFetch((url) => url.endsWith('/oauth/token') ? (accept ? { body: { access_token: 'A1' } } : { status: 400, body: { error: 'invalid_grant' } }) : { body: { ok: true } });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'wrong', fetchImpl: f, now: () => t });
    const refused = (e) => e.code === 'login' && /refused the login/.test(e.message);
    await assert.rejects(c.call('mcpInfo'), refused);
    assert.equal(f.calls.length, 1);
    await assert.rejects(c.call('mcpInfo'), refused);
    t += 59999;
    await assert.rejects(c.call('mcpList'), refused);
    assert.equal(f.calls.length, 1, 'web.0 was not contacted');
    t += 1;
    await assert.rejects(c.call('mcpInfo'), refused);
    assert.equal(f.calls.length, 2, 'one more try after 60 s');
    t += 60000;
    accept = true;
    assert.equal((await c.call('mcpInfo')).ok, true);
    assert.equal((await c.call('mcpInfo')).ok, true);
});

test('P4 parallel calls and a late 401 do not try the password again', async () => {
    let logins = 0, first = true;
    const f = fakeFetch(async (url, init) => {
        await tick();
        if (url.endsWith('/oauth/token')) {
            const grant = new URLSearchParams(init.body).get('grant_type');
            if (grant === 'password') logins++;
            if (grant === 'password' && first) { first = false; return { body: { access_token: 'A1' } }; }
            return { status: 400, body: {} };
        }
        return { status: 401, body: {} };
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f, now: () => 5 });
    await Promise.allSettled([c.call('mcpInfo'), c.call('mcpInfo'), c.call('mcpInfo')]);
    assert.equal(logins, 2, 'the first login and the one renewal');
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'login');
    assert.equal(logins, 2);
});

test('P4 a network failure at login is not a refused login', async () => {
    let up = false;
    const f = async (url) => {
        if (!up) throw new TypeError('fetch failed');
        return new Response(JSON.stringify(String(url).endsWith('/oauth/token') ? { access_token: 'A' } : { ok: true }), { status: 200 });
    };
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f, now: () => 5 });
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'network');
    up = true;
    assert.equal((await c.call('mcpInfo')).ok, true);
});

test('N2 a 502 at login is an http error, without back-off, and the body is not quoted', async () => {
    let up = false;
    const PW = 's3cr3t-pw';
    const f = fakeFetch((url, init) => {
        if (url.endsWith('/oauth/token')) return up ? { body: { access_token: 'A1' } } : { status: 502, text: '<html>bad gateway ' + init.body + '</html>' };
        return { body: { ok: true } };
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: PW, fetchImpl: f, now: () => 5 });
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'http' && e.status === 502 && !e.message.includes(PW) && !e.message.includes('bad gateway'));
    assert.equal(f.calls.length, 1);
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'http');
    assert.equal(f.calls.length, 2, 'the next call reaches the server');
    up = true;
    assert.equal((await c.call('mcpInfo')).ok, true);
});

test('N2 a 400 and a 401 are a refused login and the back-off holds', async () => {
    for (const status of [400, 401]) {
        const f = fakeFetch(() => ({ status, body: { error: 'invalid_grant' } }));
        const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f, now: () => 5 });
        await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'login');
        await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'login');
        assert.equal(f.calls.length, 1, String(status));
    }
});

test('N2 other answers at login: a redirect, a login page, a missing token, a bad body', async () => {
    const PW = 's3cr3t-pw';
    for (const answer of [{ status: 302, text: '' }, { status: 403, body: { error: 'x' } }, { status: 500, body: { error: PW } }, { text: '<html>login ' + PW + '</html>' }, { body: { nothing: 1 } }]) {
        const f = fakeFetch(() => answer);
        const c = new GatewayClient({ url: 'http://h', user: 'a', password: PW, fetchImpl: f, now: () => 5 });
        await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'http' && !e.message.includes(PW), JSON.stringify(answer));
        await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'http');
        assert.equal(f.calls.length, 2, 'no back-off: ' + JSON.stringify(answer));
    }
});

test('N2 a timeout while reading the body of the login answer is a timeout', async () => {
    const f = async (url, init) => ({
        ok: true, status: 200,
        // a body that never ends; the interval stands for the open socket (see the timeout test above)
        json: () => new Promise((_, reject) => {
            const socket = setInterval(() => { }, 1000);
            init.signal.addEventListener('abort', () => { clearInterval(socket); reject(init.signal.reason); });
        }),
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', loginTimeoutMs: 20, fetchImpl: f, now: () => 5 });
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'timeout');
});

test('N2 an expired token and a 503 on renewal: http, no back-off, no password login', async () => {
    let down = true, logins = 0, posts = 0;
    const f = fakeFetch((url, init, n) => {
        if (url.endsWith('/oauth/token')) {
            const grant = new URLSearchParams(init.body).get('grant_type');
            if (grant === 'password') { logins++; return { body: { access_token: 'A1', refresh_token: 'R1' } }; }
            return down ? { status: 503, text: 'unavailable' } : { body: { access_token: 'A2', refresh_token: 'R2' } };
        }
        posts++;
        return init.headers.Authorization === 'Bearer A2' ? { body: { ok: true } } : { status: 401, body: {} };
    });
    const c = new GatewayClient({ url: 'http://h', user: 'a', password: 'p', fetchImpl: f, now: () => 5 });
    await assert.rejects(c.call('mcpInfo'), (e) => e.code === 'http' && e.status === 503);
    assert.equal(logins, 1, 'the renewal did not fall back to the password');
    const before = posts;
    down = false;
    assert.equal((await c.call('mcpInfo')).ok, true);
    assert.ok(posts > before, 'the next call reached the server');
});
