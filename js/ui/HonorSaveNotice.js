/* Player-facing save state; raw storage data never enters the DOM. */
export function honorSaveNotice(snapshot = {}) {
  const pending = Number.isFinite(snapshot.pendingHonor) && snapshot.pendingHonor > 0
    ? ` ${snapshot.pendingHonor.toLocaleString('fr-FR')} points restent en attente pour cette session.` : '';
  if (snapshot.recoveryRequired) {
    const message = snapshot.recoveryReason === 'unsupported_version'
      ? 'Cette sauvegarde d’honneur vient d’une autre version du jeu. Elle est conservée ; les achats sont suspendus.'
      : snapshot.recoveryReason === 'storage_read_failed'
        ? 'Le stockage de l’honneur est inaccessible. Les données existantes sont conservées ; les achats sont suspendus.'
        : 'La sauvegarde d’honneur ne peut pas être lue. Les données d’origine sont conservées ; les achats sont suspendus.';
    return { visible: true, blocked: true, canRetry: true, message: message + pending, retryLabel: 'Réessayer la lecture' };
  }
  if (snapshot.status === 'storage_unavailable') {
    return { visible: true, blocked: false, canRetry: true,
      message: 'L’honneur n’a pas pu être enregistré. Aucun achat refusé n’a été débité.' + pending,
      retryLabel: 'Réessayer l’enregistrement' };
  }
  if (snapshot.status === 'memory_only') {
    return { visible: true, blocked: false, canRetry: false,
      message: 'L’honneur de cette partie est conservé pour cette session uniquement.', retryLabel: '' };
  }
  return { visible: false, blocked: false, canRetry: false, message: '', retryLabel: '' };
}

export function renderHonorSaveNotice(snapshot, documentRef = globalThis.document) {
  const notice = honorSaveNotice(snapshot);
  for (const panel of documentRef?.querySelectorAll?.('[data-honor-save-panel]') ?? []) {
    panel.hidden = !notice.visible;
    panel.setAttribute('data-save-state', notice.blocked ? 'protected' : 'pending');
    const message = panel.querySelector('[data-honor-save-message]');
    const retry = panel.querySelector('[data-honor-save-retry]');
    if (message) message.textContent = notice.message;
    if (retry) {
      retry.hidden = !notice.canRetry;
      retry.disabled = !notice.canRetry;
      retry.textContent = notice.retryLabel;
    }
  }
  return notice;
}
