/** Small plans identify a front; its source description remains in the legend.
 * Keys follow configuration order, never the HUD's changing danger priority. */
export function operationMapFrontEntries(fronts = []) {
  const compact = fronts.some(front => String(front.label ?? front.id ?? '').length > 28);
  return fronts.map((front, index) => {
    const key = String(index + 1), label = String(front.label ?? front.id ?? `Front ${key}`);
    const title = label.split(/\s*[:：]\s*/, 1)[0];
    const unknown = front.intelState === 'unknown';
    return { id: front.id, key, label, title, compact, unknown,
      mapLabel: (compact ? key : label) + (unknown ? ' ?' : '') };
  });
}

export function renderOperationFrontLegend(list, entries, { full = false } = {}) {
  const signature = JSON.stringify(entries.map(({ id, key, label, title, unknown }) => [id, key, label, title, unknown, full]));
  if (list.dataset.signature === signature) return;
  list.replaceChildren(...entries.map(entry => {
    const item = document.createElement('li'), key = document.createElement('b'), name = document.createElement('span');
    item.dataset.frontId = entry.id;
    item.setAttribute('aria-label', `${entry.key} — ${entry.label}${entry.unknown ? ' · contrôle inconnu' : ''}`);
    item.title = entry.label;
    key.textContent = entry.key;
    name.textContent = (full ? entry.label : entry.title) + (entry.unknown ? ' ?' : '');
    item.append(key, name); return item;
  }));
  list.dataset.signature = signature;
}

export function drawOperationFrontLabel(ctx, entry, x, y, width, height, fontSize = 11) {
  ctx.save(); ctx.font = `${fontSize}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const measured = ctx.measureText(entry.mapLabel)?.width;
  const halfWidth = (Number.isFinite(measured) ? measured : entry.mapLabel.length * fontSize * .6) / 2;
  const inset = halfWidth + 3;
  x = Math.min(width - inset, Math.max(inset, x));
  y = Math.min(height - 3, Math.max(fontSize + 3, y - 11));
  ctx.lineWidth = 3; ctx.strokeStyle = '#071018'; ctx.strokeText(entry.mapLabel, x, y);
  ctx.fillStyle = '#f3f6df'; ctx.fillText(entry.mapLabel, x, y); ctx.restore();
}
