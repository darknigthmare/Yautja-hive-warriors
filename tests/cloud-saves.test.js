import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSaves, CLOUD_CONFIG } from '../js/engine/CloudSaves.js';
import { AscensionProgress } from '../js/data/AscensionProgress.js';

/* HW-DEC-109: sign-in on the existing accounts, owner-scoped row per app, loss-free merge. No network here. */
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
function server() {
  const rows = new Map(), calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options }); const body = options.body ? JSON.parse(options.body) : null;
    const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (url.includes('/auth/v1/token?grant_type=password')) return body.password === 'ok' ? reply(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1', email: body.email } }) : reply(400, { error_description: 'Invalid login credentials' });
    if (url.includes('/rest/v1/app_cloud_saves') && options.method === 'POST') { rows.set(`${body.user_id}:${body.app_key}`, body.payload); return reply(201, null); }
    if (url.includes('/rest/v1/app_cloud_saves')) { const key = `u1:${new URL(url).searchParams.get('app_key').slice(3)}`; return reply(200, rows.has(key) ? [{ payload: rows.get(key) }] : []); }
    return reply(404, {});
  };
  return { rows, calls, fetchImpl };
}

test('sign-in keeps a session, uses only the publishable key and sends owner-scoped rows', async () => {
  const fake = server(), storage = memory(), cloud = new CloudSaves({ storage, fetchImpl: fake.fetchImpl });
  await assert.rejects(cloud.signIn('a@b.c', 'bad'), /Invalid login/);
  await cloud.signIn('a@b.c', 'ok'); assert.equal(cloud.signedIn, true);
  assert.equal(new CloudSaves({ storage, fetchImpl: fake.fetchImpl }).signedIn, true, 'the session survives a reload');
  await cloud.push('hive_warriors_ascension', { version: 1, completed: ['vara_kesh'], tools: ['netgun'], blooded: false });
  assert.deepEqual(await cloud.pull('hive_warriors_ascension'), { version: 1, completed: ['vara_kesh'], tools: ['netgun'], blooded: false });
  assert.ok(fake.calls.every(call => call.options.headers.apikey === CLOUD_CONFIG.publishableKey));
  assert.ok(CLOUD_CONFIG.publishableKey.startsWith('sb_publishable_'), 'never a secret key');
  await assert.rejects(cloud.push('Bad-Key', {}), /invalide/);
  cloud.signOut(); assert.equal(new CloudSaves({ storage, fetchImpl: fake.fetchImpl }).signedIn, false);
});

test('two devices merge their Ascension progress without losing anything', () => {
  const here = new AscensionProgress(memory()); here.complete('vara_kesh');
  const changed = here.merge({ version: 1, completed: ['vara_kesh', 'eshra', 'not-a-world'], tools: ['netgun', 'bear_trap'], blooded: false });
  assert.equal(changed, true);
  assert.deepEqual(here.state.completed, ['vara_kesh', 'eshra']); assert.deepEqual(here.state.tools, ['netgun', 'bear_trap']);
  assert.equal(here.merge({ version: 1, completed: [], tools: [], blooded: false }), false, 'an older record removes nothing');
  assert.equal(here.merge({ version: 2 }), false);
});
