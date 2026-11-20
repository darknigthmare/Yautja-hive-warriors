/* Account saves on the existing Supabase project (HW-DEC-109): e-mail and password sign-in on the
 * accounts already used by the other apps, and one row per user and app in public.app_cloud_saves,
 * protected by owner-only row-level security. No dependency: plain fetch on the public REST and
 * auth endpoints with the project's publishable key (never a secret). */
export const CLOUD_CONFIG = Object.freeze({
  url: 'https://hykklcvvwjwhcvukbzts.supabase.co',
  publishableKey: 'sb_publishable_hAcM5bQMkl9a0wn7tgzupg_DeSgYQZC'
});
const SESSION_KEY = 'yautja-cloud-session-v1';
const APP_KEY = /^[a-z0-9_]{1,120}$/;

export class CloudSaves {
  constructor({ storage = null, fetchImpl = globalThis.fetch?.bind(globalThis), config = CLOUD_CONFIG } = {}) {
    this.storage = storage; this.fetch = fetchImpl; this.config = config; this.session = null;
    try { const saved = JSON.parse(storage?.getItem(SESSION_KEY) ?? 'null'); if (saved?.accessToken && saved?.userId) this.session = saved; } catch {}
  }

  get signedIn() { return Boolean(this.session); }
  get email() { return this.session?.email ?? null; }

  _headers(token = null, extra = {}) {
    return { apikey: this.config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
  }

  _store(data, email) {
    this.session = { accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user?.id, email: data.user?.email ?? email,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000 };
    try { this.storage?.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch {}
    return this.session;
  }

  async signIn(email, password) {
    if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || !password) throw new Error('E-mail et mot de passe requis.');
    const response = await this.fetch(`${this.config.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: this._headers(), body: JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(data.error_description ?? data.msg ?? 'Connexion refusée.');
    return this._store(data, email);
  }

  signOut() { this.session = null; try { this.storage?.removeItem?.(SESSION_KEY); } catch {} }

  async _token() {
    if (!this.session) throw new Error('Non connecté.');
    if (Date.now() < this.session.expiresAt - 30000) return this.session.accessToken;
    const response = await this.fetch(`${this.config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: this._headers(), body: JSON.stringify({ refresh_token: this.session.refreshToken }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) { this.signOut(); throw new Error('Session expirée : reconnectez-vous.'); }
    return this._store(data, this.session.email).accessToken;
  }

  async pull(appKey) {
    if (!APP_KEY.test(appKey)) throw new Error('Clé d’application invalide.');
    const token = await this._token();
    const query = `select=payload,updated_at&app_key=eq.${encodeURIComponent(appKey)}&user_id=eq.${encodeURIComponent(this.session.userId)}`;
    const response = await this.fetch(`${this.config.url}/rest/v1/app_cloud_saves?${query}`, { headers: this._headers(token) });
    if (!response.ok) throw new Error('Lecture de la sauvegarde en ligne impossible.');
    const rows = await response.json();
    return rows[0]?.payload ?? null;
  }

  async push(appKey, payload) {
    if (!APP_KEY.test(appKey) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Sauvegarde invalide.');
    const token = await this._token();
    const response = await this.fetch(`${this.config.url}/rest/v1/app_cloud_saves?on_conflict=user_id,app_key`, { method: 'POST',
      headers: this._headers(token, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ user_id: this.session.userId, app_key: appKey, payload, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error('Envoi de la sauvegarde en ligne impossible.');
    return true;
  }
}
