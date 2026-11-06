// The mywebui gateway, as an agent's process reaches it: web.0's OAuth2 password grant
// (POST /oauth/token), then POST /mywebui-api/<command>?ns=<instance> with the bearer token.
// web.0 sets the request's user from the token; mywebui.0 checks what that user may do.
export class GatewayError extends Error {
    constructor(code, message, status) { super(message); this.code = code; if (status != null) this.status = status; }
}

export class GatewayClient {
    #url; #user; #password; #token; #refresh = null; #instance; #fetch;

    constructor({ url, user, password, token, instance = 'mywebui.0', fetchImpl = globalThis.fetch }) {
        if (!url) throw new GatewayError('config', 'MYWEBUI_URL is not set');
        this.#url = String(url).replace(/\/+$/, '');
        this.#user = user || null;
        this.#password = password || null;
        this.#token = token || null;
        this.#instance = instance;
        this.#fetch = fetchImpl;
    }

    async #tokenRequest(form) {
        const res = await this.#fetch(this.#url + '/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: 'ioBroker', ...form }).toString(),
        });
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
        return this.#fetch(`${this.#url}/mywebui-api/${encodeURIComponent(command)}?ns=${encodeURIComponent(this.#instance)}`, {
            method: 'POST', headers, body: JSON.stringify(body ?? {}),
        });
    }

    /** One gateway command; resolves the answer, throws GatewayError(code, reason) on a refusal. */
    async call(command, body = {}) {
        if (!this.#token) await this.#login();
        let res = await this.#post(command, body);
        if (res.status === 401 && (this.#user || this.#refresh) && await this.#renew()) res = await this.#post(command, body);
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new GatewayError(res.status === 401 ? 'login' : 'http', `${command}: HTTP ${res.status}${j?.error ? ' - ' + j.error : ''}`, res.status);
        if (j && j.ok === false) throw new GatewayError(j.code || 'failed', j.reason || j.error || 'refused');
        return j;
    }
}
