/* Earned honor is a persistent balance; a score supplied by the UI cannot fund purchases. */
const KEY = 'yautja_honor_ledger_v1';
const amount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
const validTrophy = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300 && !/[\u0000-\u001f]/.test(value);
const dictionary = value => Object.assign(Object.create(null), value ?? {});
const availableStorage = () => {
  try { return globalThis.localStorage; } catch {
    // Access itself can be denied (before getItem runs). Keep that distinction
    // from an explicitly memory-only game, and let a later retry reacquire it.
    return { getItem: key => globalThis.localStorage.getItem(key),
      setItem: (key, value) => globalThis.localStorage.setItem(key, value) };
  }
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validKind = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f]/.test(value);
const FIELDS = new Set(['version', 'earned', 'spent', 'transactions', 'closedSessions', 'trophies']);

function readLedger(storage) {
  if (!storage) return { source: null };
  let raw;
  try { raw = storage.getItem(KEY); } catch { return { reason: 'storage_read_failed' }; }
  // Only an actual absence permits migration from the legacy KO/forge stores.
  // A read error, an empty string or a saved JSON null is not an empty slot.
  if (raw === null) return { source: null };
  if (typeof raw !== 'string') return { reason: 'invalid_record' };
  let saved;
  try { saved = JSON.parse(raw); } catch { return { reason: 'parse_error' }; }
  if (!object(saved)) return { reason: 'invalid_record' };
  if (saved.version !== 1) return { reason: Number.isInteger(saved.version) ? 'unsupported_version' : 'invalid_record', saved };
  const transactions = saved.transactions === undefined ? {} : saved.transactions;
  const closedSessions = saved.closedSessions === undefined ? {} : saved.closedSessions;
  const trophies = saved.trophies === undefined ? [] : saved.trophies;
  if (!amount(saved.earned) || !amount(saved.spent) || saved.spent > saved.earned ||
      !object(transactions) || !Object.entries(transactions).every(([id, record]) => validId(id) && object(record) &&
        Number.isSafeInteger(record.amount) && Math.abs(record.amount) <= 1e12 &&
        (record.kind === undefined || validKind(record.kind)) && (record.sessionId === undefined || validId(record.sessionId))) ||
      !object(closedSessions) || !Object.entries(closedSessions).every(([id, value]) => validId(id) && value === true) ||
      !Array.isArray(trophies) || !trophies.every(validTrophy)) return { reason: 'invalid_record', saved };
  return { source: saved };
}

export class HonorLedger {
  constructor({ storage = availableStorage(), earned = 0, spent = 0 } = {}) {
    this.storage = storage; this.persistent = Boolean(storage);
    this.pendingCredits = new Map();
    this.legacy = { earned: Math.max(amount(earned) ? earned : 0, amount(spent) ? spent : 0), spent: amount(spent) ? spent : 0 };
    this._acceptRecord(null);
    const loaded = readLedger(storage);
    if (loaded.reason) { this._protectRecord(loaded); return; }
    this._acceptRecord(loaded.source);
    // Reading a valid record is side-effect free, including additive v1 fields.
    if (!loaded.source) this._save();
  }
  _acceptRecord(source) {
    this.earned = source?.earned ?? this.legacy.earned;
    this.spent = source?.spent ?? this.legacy.spent;
    this.transactions = dictionary(source?.transactions);
    this.closedSessions = dictionary(source?.closedSessions);
    this.trophies = new Set(source?.trophies ?? []);
    this.extraFields = dictionary(Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => !FIELDS.has(key))));
    this.readOnly = false; this.recoveryReason = null;
    this.status = source ? 'loaded' : this.storage ? 'empty' : 'memory_only';
    this.persistent = Boolean(this.storage);
  }
  _protectRecord({ reason, saved }) {
    this.readOnly = true; this.recoveryReason = reason;
    this.status = 'recovery_required'; this.persistent = false;
    // Valid names remain visible, but unvalidated balances/receipts cannot fund
    // purchases. The original slot remains untouched for repair or a newer build.
    if (Array.isArray(saved?.trophies)) for (const trophy of saved.trophies) if (validTrophy(trophy)) this.trophies.add(trophy);
  }
  get balance() { return this.earned - this.spent; }
  hasTransaction(id) { return Object.hasOwn(this.transactions, id); }
  hasPendingReward(id) { return this.pendingCredits.has(id); }
  _save() {
    if (this.readOnly) { this.persistent = false; return false; }
    if (!this.storage) { this.status = 'memory_only'; this.persistent = false; return true; }
    try {
      this.storage.setItem(KEY, JSON.stringify({ ...this.extraFields, version: 1, earned: this.earned, spent: this.spent,
        transactions: this.transactions, closedSessions: this.closedSessions, trophies: [...this.trophies] }));
      this.status = 'saved'; this.persistent = true; return true;
    } catch { this.status = 'storage_unavailable'; this.persistent = false; return false; }
  }
  retryRecovery() {
    if (!this.readOnly) {
      if (!this.retryPending()) return false;
      return this.status === 'storage_unavailable' ? this._save() : true;
    }
    const loaded = readLedger(this.storage);
    if (loaded.reason) { this._protectRecord(loaded); return false; }
    this._acceptRecord(loaded.source);
    // A restored record may already contain a pending death or its finalized
    // session. Treat those as receipts, not as another opportunity to earn.
    for (const [id, reward] of this.pendingCredits) {
      if (this.hasTransaction(id) || reward.sessionId && Object.hasOwn(this.closedSessions, reward.sessionId)) this.pendingCredits.delete(id);
    }
    if (this.pendingCredits.size) return this.retryPending();
    return loaded.source ? true : this._save();
  }
  earn({ id, amount: value, kind = 'combat', trophy, sessionId } = {}) {
    if (!validId(id) || !validKind(kind) || !amount(value) || !amount(this.earned + value) || this.hasTransaction(id) || this.hasPendingReward(id) ||
      (sessionId && (!validId(sessionId) || Object.hasOwn(this.closedSessions, sessionId)))) return false;
    const hadTrophy = this.trophies.has(trophy);
    this.earned += value; this.transactions[id] = { amount: value, kind, ...(sessionId ? { sessionId } : {}) };
    if (validTrophy(trophy)) this.trophies.add(trophy);
    if (this._save()) return true;
    this.earned -= value; delete this.transactions[id]; if (!hadTrophy) this.trophies.delete(trophy);
    this.pendingCredits.set(id, { id, amount: value, kind, trophy, sessionId }); return false;
  }
  retryPending() {
    if (this.readOnly) return false;
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
    if (this.readOnly) return false;
    this.retryPending();
    if (!validId(id) || !validKind(kind) || !amount(value) || value > this.balance || this.hasTransaction(id)) return false;
    this.spent += value; this.transactions[id] = { amount: -value, kind };
    if (this._save()) return true;
    this.spent -= value; delete this.transactions[id]; return false;
  }
  closeSession(sessionId) {
    if (this.readOnly) return false;
    if (!this.retryPending()) return false;
    if (!validId(sessionId) || Object.hasOwn(this.closedSessions, sessionId)) return false;
    const records = Object.entries(this.transactions).filter(([, record]) => record.sessionId === sessionId);
    this.closedSessions[sessionId] = true; records.forEach(([id]) => { delete this.transactions[id]; });
    if (this._save()) return true;
    delete this.closedSessions[sessionId]; records.forEach(([id, record]) => { this.transactions[id] = record; }); return false;
  }
  getSnapshot() { return { earned: this.earned, spent: this.spent, balance: this.balance, trophies: [...this.trophies], persistent: this.persistent,
    status: this.status, readOnly: this.readOnly, recoveryRequired: this.readOnly, recoveryReason: this.recoveryReason,
    pendingRewards: this.pendingCredits.size, pendingHonor: [...this.pendingCredits.values()].reduce((sum, record) => sum + record.amount, 0) }; }
}
