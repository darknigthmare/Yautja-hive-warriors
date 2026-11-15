/* Earned honor is a persistent balance; a score supplied by the UI cannot fund purchases. */
const KEY = 'yautja_honor_ledger_v1';
const amount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
const validTrophy = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300 && !/[\u0000-\u001f]/.test(value);
const dictionary = value => Object.assign(Object.create(null), value ?? {});
const availableStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };

export class HonorLedger {
  constructor({ storage = availableStorage(), earned = 0, spent = 0 } = {}) {
    this.storage = storage; this.persistent = Boolean(storage);
    this.pendingCredits = new Map();
    let saved;
    try { saved = JSON.parse(storage?.getItem(KEY) ?? 'null'); } catch { /* Unavailable storage keeps a playable session. */ }
    const source = saved?.version === 1 && amount(saved.earned) && amount(saved.spent) && saved.spent <= saved.earned ? saved : null;
    this.earned = source?.earned ?? Math.max(amount(earned) ? earned : 0, amount(spent) ? spent : 0);
    this.spent = source?.spent ?? (amount(spent) ? spent : 0);
    this.transactions = dictionary(Object.fromEntries(Object.entries(source?.transactions ?? {}).filter(([id, record]) => validId(id) && record && Number.isSafeInteger(record.amount) && Math.abs(record.amount) <= 1e12)));
    this.closedSessions = dictionary(Object.fromEntries(Object.entries(source?.closedSessions ?? {}).filter(([id, value]) => validId(id) && value === true)));
    this.trophies = new Set(Array.isArray(source?.trophies) ? source.trophies.filter(validTrophy) : []);
    this._save();
  }
  get balance() { return this.earned - this.spent; }
  hasTransaction(id) { return Object.hasOwn(this.transactions, id); }
  hasPendingReward(id) { return this.pendingCredits.has(id); }
  _save() {
    if (!this.storage) { this.persistent = false; return true; }
    try {
      this.storage.setItem(KEY, JSON.stringify({ version: 1, earned: this.earned, spent: this.spent,
        transactions: this.transactions, closedSessions: this.closedSessions, trophies: [...this.trophies] }));
      this.persistent = true; return true;
    } catch { this.persistent = false; return false; }
  }
  earn({ id, amount: value, kind = 'combat', trophy, sessionId } = {}) {
    if (!validId(id) || !amount(value) || !amount(this.earned + value) || this.hasTransaction(id) || this.hasPendingReward(id) ||
      (sessionId && (!validId(sessionId) || Object.hasOwn(this.closedSessions, sessionId)))) return false;
    const hadTrophy = this.trophies.has(trophy);
    this.earned += value; this.transactions[id] = { amount: value, kind, ...(sessionId ? { sessionId } : {}) };
    if (validTrophy(trophy)) this.trophies.add(trophy);
    if (this._save()) return true;
    this.earned -= value; delete this.transactions[id]; if (!hadTrophy) this.trophies.delete(trophy);
    this.pendingCredits.set(id, { id, amount: value, kind, trophy, sessionId }); return false;
  }
  retryPending() {
    if (!this.pendingCredits.size) return true;
    const records = [...this.pendingCredits.values()], previousEarned = this.earned, trophies = new Set(this.trophies);
    if (!amount(this.earned + records.reduce((total, record) => total + record.amount, 0))) return false;
    for (const record of records) {
      this.earned += record.amount; this.transactions[record.id] = { amount: record.amount, kind: record.kind, ...(record.sessionId ? { sessionId: record.sessionId } : {}) };
      if (validTrophy(record.trophy)) this.trophies.add(record.trophy);
    }
    if (this._save()) { this.pendingCredits.clear(); return true; }
    this.earned = previousEarned; this.trophies = trophies;
    records.forEach(record => { delete this.transactions[record.id]; }); return false;
  }
  spend({ id, amount: value, kind = 'upgrade' } = {}) {
    this.retryPending();
    if (!validId(id) || !amount(value) || value > this.balance || this.hasTransaction(id)) return false;
    this.spent += value; this.transactions[id] = { amount: -value, kind };
    if (this._save()) return true;
    this.spent -= value; delete this.transactions[id]; return false;
  }
  closeSession(sessionId) {
    if (!this.retryPending()) return false;
    if (!validId(sessionId) || Object.hasOwn(this.closedSessions, sessionId)) return false;
    const records = Object.entries(this.transactions).filter(([, record]) => record.sessionId === sessionId);
    this.closedSessions[sessionId] = true; records.forEach(([id]) => { delete this.transactions[id]; });
    if (this._save()) return true;
    delete this.closedSessions[sessionId]; records.forEach(([id, record]) => { this.transactions[id] = record; }); return false;
  }
  getSnapshot() { return { earned: this.earned, spent: this.spent, balance: this.balance, trophies: [...this.trophies], persistent: this.persistent,
    pendingRewards: this.pendingCredits.size, pendingHonor: [...this.pendingCredits.values()].reduce((sum, record) => sum + record.amount, 0) }; }
}
