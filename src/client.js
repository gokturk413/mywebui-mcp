// The mywebui gateway, as an agent's process reaches it: web.0's OAuth2 password grant
// (POST /oauth/token), then POST /mywebui-api/<command>?ns=<instance> with the bearer token.
// web.0 sets the request's user from the token; mywebui.0 checks what that user may do.
export class GatewayError extends Error {
    constructor(code, message, status) { super(message); this.code = code; if (status != null) this.status = status; }
}

export class GatewayClient {
    #url; #user; #password; #token; #refresh = null; #instance; #fetch; #loginTimeoutMs; #callTimeoutMs;

    constructor({ url, user, password, token, instance = 'mywebui.0', fetchImpl = globalThis.fetch, loginTimeoutMs = 15000, callTimeoutMs = 70000 }) {
        if (!url) throw new GatewayError('config', 'MYWEBUI_URL is not set');
        this.#url = String(url).replace(/\/+$/, '');
        this.#user = user || null;
        this.#password = password || null;
        this.#token = token || null;
        this.#instance = instance;
        this.#fetch = fetchImpl;
        this.#loginTimeoutMs = loginTimeoutMs;
        this.#callTimeoutMs = callTimeoutMs;
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
        if (!res.ok) return null;
        const j = await res.json().catch(() => null);
        if (!j?.access_token) return null;
        this.#token = j.access_token;
        this.#refresh = j.refresh_token ?? null;
        return this.#token;
    }
    async #login() {
        if (!this.#user || !this.#password) return null;
        const t = await this.#tokenRequest({ grant_type: 'password', username: this.#user, password: this.#password });
        if (!t) throw new GatewayError('login', `web.0 refused the login of "${this.#user}"`);
        return t;
    }
    async #renew() {
        if (this.#refresh && await this.#tokenRequest({ grant_type: 'refresh_token', refresh_token: this.#refresh })) return true;
        this.#token = null;
        return !!(await this.#login());
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
        if (!this.#token) await this.#login();
        let res = await this.#post(command, body);
        if (res.status === 401 && (this.#user || this.#refresh) && await this.#renew()) res = await this.#post(command, body);
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new GatewayError(res.status === 401 ? 'login' : 'http', `${command}: HTTP ${res.status}${j?.error ? ' - ' + this.#scrub(j.error) : ''}`, res.status);
        if (!j || typeof j !== 'object') throw new GatewayError('http', `${command}: the answer is not JSON (HTTP ${res.status})`, res.status);
        if (j.ok === false) throw new GatewayError(j.code || 'failed', this.#scrub(j.reason || j.error || 'refused'));
        return j;
    }
}
