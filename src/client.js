// The mywebui gateway, as an agent's process reaches it: web.0's OAuth2 password grant
// (POST /oauth/token), then POST /mywebui-api/<command>?ns=<instance> with the bearer token.
// web.0 sets the request's user from the token; mywebui.0 checks what that user may do.
export class GatewayError extends Error {
    constructor(code, message, status) { super(message); this.code = code; if (status != null) this.status = status; }
}

const LOGIN_BACKOFF_MS = 60000;   // web.0 locks a user after repeated failures
const NEEDS_CREDENTIALS = 'set MYWEBUI_USER + MYWEBUI_PASSWORD or MYWEBUI_TOKEN (web.0 must have authentication)';

/** The base address, checked. A message never quotes the value: it may hold a password. */
function baseUrl(url) {
    if (!url) throw new GatewayError('config', 'MYWEBUI_URL is not set');
    let u;
    try { u = new URL(String(url)); } catch { throw new GatewayError('config', 'MYWEBUI_URL is not a valid address'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new GatewayError('config', 'MYWEBUI_URL must be http or https');
    if (u.username || u.password) throw new GatewayError('config', 'MYWEBUI_URL must not hold credentials: use MYWEBUI_USER + MYWEBUI_PASSWORD');
    if (u.search || u.hash) throw new GatewayError('config', 'MYWEBUI_URL must not have a query or a fragment');
    return (u.origin + u.pathname).replace(/\/+$/, '');
}

export class GatewayClient {
    #url; #user; #password; #token; #refresh = null; #instance; #fetch; #loginTimeoutMs; #callTimeoutMs; #now;
    #authenticating = null;       // the one login or renewal in flight
    #refused = null;              // the last refused login, until #refusedUntil
    #refusedUntil = 0;

    constructor({ url, user, password, token, instance = 'mywebui.0', fetchImpl = globalThis.fetch, loginTimeoutMs = 15000, callTimeoutMs = 70000, now = Date.now }) {
        this.#url = baseUrl(url);
        if (user && !password) throw new GatewayError('config', `MYWEBUI_USER without MYWEBUI_PASSWORD: ${NEEDS_CREDENTIALS}`);
        if (!token && !(user && password)) throw new GatewayError('config', `no credentials: ${NEEDS_CREDENTIALS}`);
        this.#user = user || null;
        this.#password = password || null;
        this.#token = token || null;
        this.#instance = instance;
        this.#fetch = fetchImpl;
        this.#loginTimeoutMs = loginTimeoutMs;
        this.#callTimeoutMs = callTimeoutMs;
        this.#now = now;
    }

    /** Server text for a message: coerced to a string, credentials removed. */
    #scrub(v) {
        let t = String(v);
        for (const secret of [this.#password, this.#token, this.#refresh]) if (secret) t = t.split(secret).join('***');
        return t;
    }
    /** fetch with a timeout; network failures and timeouts become GatewayErrors (never carrying a secret). */
    async #send(what, url, init, timeoutMs) {
        try {
            return await this.#fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        } catch (e) {
            if (e instanceof GatewayError) throw e;
            if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new GatewayError('timeout', `${what}: no answer from ${new URL(url).host} within ${timeoutMs} ms`);
            throw new GatewayError('network', `${what}: ${new URL(url).host} unreachable: ${this.#scrub(e?.cause?.message ?? e?.message ?? e)}`);
        }
    }

    async #tokenRequest(form) {
        const res = await this.#send('login', this.#url + '/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: 'ioBroker', ...form }).toString(),
        }, this.#loginTimeoutMs);
        // only these two say the credentials are wrong; a proxy's or server's error says nothing about them
        if (res.status === 400 || res.status === 401) return null;
        if (!res.ok) throw new GatewayError('http', `login: HTTP ${res.status}`, res.status);
        let j;
        try {
            j = await res.json();
        } catch (e) {
            if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new GatewayError('timeout', `login: no answer from ${new URL(this.#url).host} within ${this.#loginTimeoutMs} ms`);
            throw new GatewayError('http', `login: the answer is not JSON (HTTP ${res.status})`, res.status);
        }
        if (!j?.access_token) throw new GatewayError('http', `login: the answer holds no token (HTTP ${res.status})`, res.status);
        this.#token = j.access_token;
        this.#refresh = j.refresh_token ?? null;
        return this.#token;
    }
    async #login() {
        if (!this.#user || !this.#password) return null;
        const t = await this.#tokenRequest({ grant_type: 'password', username: this.#user, password: this.#password });
        if (!t) {
            this.#refused = new GatewayError('login', `web.0 refused the login of "${this.#user}"`);
            this.#refusedUntil = this.#now() + LOGIN_BACKOFF_MS;
            throw this.#refused;
        }
        this.#refused = null;
        return t;
    }
    async #renew() {
        if (this.#refresh && await this.#tokenRequest({ grant_type: 'refresh_token', refresh_token: this.#refresh })) return true;
        return !!(await this.#login());
    }
    #checkRefused() {
        if (this.#refused && this.#now() < this.#refusedUntil) throw this.#refused;
    }
    /** One login or renewal at a time: parallel calls share the one in flight, and its outcome. */
    #authenticate(step) {
        if (!this.#authenticating) {
            this.#authenticating = (async () => { this.#checkRefused(); return step(); })().finally(() => { this.#authenticating = null; });
        }
        return this.#authenticating;
    }
    async #post(command, body) {
        const headers = { 'Content-Type': 'application/json', 'X-Mywebui-Gateway': '1' };
        if (this.#token) headers.Authorization = 'Bearer ' + this.#token;
        return this.#send(command, `${this.#url}/mywebui-api/${encodeURIComponent(command)}?ns=${encodeURIComponent(this.#instance)}`, {
            method: 'POST', headers, body: JSON.stringify(body ?? {}),
        }, this.#callTimeoutMs);
    }

    /** One gateway command; resolves the answer, throws GatewayError(code, reason) on a refusal. */
    async call(command, body = {}) {
        await this.#authenticating?.catch(() => { });   // its outcome is looked at next
        this.#checkRefused();
        if (!this.#token) await this.#authenticate(() => this.#login());
        const sent = this.#token;
        let res = await this.#post(command, body);
        if (res.status === 401 && (this.#user || this.#refresh)) {
            // a parallel call may have renewed the token while this one was on its way
            if (this.#token !== sent || await this.#authenticate(() => this.#renew())) res = await this.#post(command, body);
        }
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new GatewayError(res.status === 401 ? 'login' : 'http', `${command}: HTTP ${res.status}${j?.error ? ' - ' + this.#scrub(j.error) : ''}`, res.status);
        if (!j || typeof j !== 'object') throw new GatewayError('http', `${command}: the answer is not JSON (HTTP ${res.status})`, res.status);
        // web.0 itself answers 200 { error } when mywebui.0 is stopped or slow
        if (j.ok !== true) throw new GatewayError(j.code || 'failed', this.#scrub(j.reason || j.error || 'refused'));
        return j;
    }
}
