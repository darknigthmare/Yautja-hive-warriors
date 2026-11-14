/* Preparation uses the runtime's equipment permissions, not a second roster.
 * Existing GameApp callers remain valid; tests/embedders may inject getContext. */
import { HUNTER_WEAPON_PROFILES, ADAPTED_GADGETS, getHunterLoadoutOptions,
  resolveHunterLoadout, hunterEquipmentLabel } from '../data/hunterArsenal.js';

function defaultLoadoutContext() {
  const game = globalThis.window?.gameInstance ?? globalThis.window?.game;
  return { characterId: game?.ui?.selectedChar?.id ?? null,
    fidelityMode: document.getElementById('fidelity-mode-select')?.value ?? 'adapted' };
}

const SLOTS = [
  { key: 'primary', selector: '.loadout-primary-btn', field: 'selectedPrimary' },
  { key: 'secondary', selector: '.loadout-secondary-btn', field: 'selectedSecondary' },
  { key: 'gadgets', selector: '.loadout-gadget-btn', field: 'selectedGadgets' }
];

export class LoadoutScreen {
  constructor(onConfirmLoadout, { getContext = defaultLoadoutContext } = {}) {
    this.onConfirmLoadout = onConfirmLoadout;
    this.getContext = getContext;
    this.screen = document.getElementById('loadout-prep-screen');
    this.modeSelect = document.getElementById('fidelity-mode-select');
    this.feedbackNode = document.getElementById('loadout-feedback');
    this.selectedPrimary = 'wristblades';
    this.selectedSecondary = 'smart_disc';
    this.selectedPlasma = 'single_caster';
    this.selectedGadgets = ['medicomp', 'bear_trap'];
    this.selections = new Map();
    this.listeners = [];
    this.contextKey = null;
    this.disposed = false;
    this.confirming = false;
    this.deploymentFailure = null;
    if (!this.screen) return;

    this.ensureOptions();
    this.summaryNode = document.createElement('p');
    this.summaryNode.id = 'loadout-reference-summary';
    this.summaryNode.className = 'selection-feedback';
    this.referenceNode = document.createElement('details');
    this.referenceNode.id = 'loadout-reference-details';
    this.referenceNode.className = 'operation-provenance';
    this.feedbackNode?.before(this.summaryNode, this.referenceNode);
    const faithfulOption = this.modeSelect?.querySelector('option[value="faithful"]');
    if (faithfulOption) faithfulOption.textContent = 'Référence : équipement restreint à l’incarnation';
    this.setupListeners();
    this.syncSelection();

    // UIManager/GameApp already own screen transitions, including replay and
    // campaign. Observe this screen's visibility only; never poll each frame.
    if (typeof globalThis.MutationObserver === 'function') {
      this.observer = new MutationObserver(() => {
        if (!this.screen.classList.contains('hidden')) {
          this.confirming = false;
          this.syncSelection();
          if (!this.screen.contains(document.activeElement)) this.modeSelect?.focus({ preventScroll: true });
        }
      });
      this.observer.observe(this.screen, { attributes: true, attributeFilter: ['class'] });
    }
  }

  ensureOptions() {
    for (const slot of SLOTS) {
      const existing = [...this.screen.querySelectorAll(slot.selector)];
      const parent = existing[0]?.parentElement;
      if (!parent) continue;
      const byId = new Map(existing.map(button => [button.dataset.item, button]));
      const ids = slot.key === 'gadgets' ? ADAPTED_GADGETS : Object.keys(HUNTER_WEAPON_PROFILES);
      for (const id of ids) {
        let button = byId.get(id);
        if (!button) {
          button = document.createElement('button');
          button.className = `loadout-btn ${slot.selector.slice(1)}`;
          button.dataset.item = id;
          parent.append(button);
        }
        button.type = 'button';
        button.textContent = hunterEquipmentLabel(id);
      }
    }
  }

  selection() {
    return { primary: this.selectedPrimary, secondary: this.selectedSecondary,
      gadgets: Array.isArray(this.selectedGadgets) ? [...this.selectedGadgets] : [] };
  }

  setSelection(value) {
    this.selectedPrimary = value.primary;
    this.selectedSecondary = value.secondary;
    this.selectedGadgets = [...value.gadgets];
    this.selectedPlasma = value.ranged === 'plasma_caster' ? 'single_caster' : value.ranged;
  }

  feedback(message) { if (this.feedbackNode) this.feedbackNode.textContent = message; }

  syncSelection() {
    if (this.disposed || !this.screen) return null;
    const context = this.getContext?.() ?? {};
    const characterId = typeof context.characterId === 'string' ? context.characterId : null;
    const options = getHunterLoadoutOptions(characterId, context.fidelityMode);
    const key = `${options.fidelityMode}:${characterId ?? ''}`;
    const changed = key !== this.contextKey;
    if (changed) {
      this.deploymentFailure = null;
      if (this.contextKey !== null) this.selections.set(this.contextKey, this.selection());
      this.setSelection(this.selections.get(key) ?? options.defaults);
      this.contextKey = key;
    }
    this.characterId = characterId;
    this.options = options;
    const resolved = resolveHunterLoadout(characterId, { ...this.selection(), fidelityMode: options.fidelityMode });
    this.setSelection(resolved);
    const focused = document.activeElement;
    for (const slot of SLOTS) {
      const permitted = slot.key === 'gadgets' ? options.gadgets : options.weapons;
      const selected = slot.key === 'gadgets' ? this.selectedGadgets : [this[slot.field]];
      for (const button of this.screen.querySelectorAll(slot.selector)) {
        const allowed = permitted.includes(button.dataset.item);
        const active = allowed && selected.includes(button.dataset.item);
        button.disabled = !allowed;
        button.hidden = !allowed;
        button.classList.toggle('hidden', !allowed);
        button.classList.toggle('selected', active);
        button.setAttribute('aria-disabled', String(!allowed));
        button.setAttribute('aria-pressed', String(active));
        button.title = allowed ? hunterEquipmentLabel(button.dataset.item) : 'Hors du kit de référence de cette incarnation.';
      }
    }
    const confirm = document.getElementById('btn-confirm-loadout');
    const unavailable = options.fidelityMode === 'faithful' && !options.referenceKnown;
    if (confirm) confirm.disabled = unavailable;
    if (focused && this.screen.contains(focused) && (focused.disabled || focused.hidden)) {
      this.screen.querySelector('.loadout-btn.selected:not([disabled])')?.focus({ preventScroll: true });
    }
    this.feedback(this.deploymentFailure ?? (unavailable ? 'Choisissez un chasseur possédant un kit de référence avant de vous déployer.'
      : `${this.selectedGadgets.length} gadget${this.selectedGadgets.length === 1 ? '' : 's'} sélectionné${this.selectedGadgets.length === 1 ? '' : 's'} sur 2`));
    this.summaryNode.textContent = `${options.fidelityMode === 'faithful' ? options.continuity ?? 'Référence inconnue' : 'Affrontement adapté — choix libres'} · Principale : ${hunterEquipmentLabel(resolved.primary)} · Secondaire : ${hunterEquipmentLabel(resolved.secondary)} · Tir dédié : ${resolved.ranged ? hunterEquipmentLabel(resolved.ranged) : 'aucun'}.`;
    if (changed) this.renderReference();
    return resolved;
  }

  renderReference() {
    const summary = document.createElement('summary');
    summary.textContent = 'Références et limites du kit';
    const note = document.createElement('p');
    note.textContent = 'Le mode de référence filtre l’équipement disponible. Les statistiques, les actions Musou, les modèles et les cartes restent des adaptations ; aucune fidélité visuelle 1:1 n’est certifiée. Une figurine sous licence ne constitue pas un inventaire exhaustif du film.';
    const list = document.createElement('ul');
    for (const [index, url] of this.options.sourceUrls.entries()) {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = `Référence ${index + 1} · ${new URL(url).hostname}`;
      item.append(link); list.append(item);
    }
    this.referenceNode.replaceChildren(summary, note, list);
  }

  listen(node, name, handler) {
    if (!node) return;
    node.addEventListener(name, handler);
    this.listeners.push(() => node.removeEventListener(name, handler));
  }

  setupListeners() {
    if (this.listening || !this.screen) return;
    this.listening = true;
    for (const slot of SLOTS) for (const button of this.screen.querySelectorAll(slot.selector)) {
      this.listen(button, 'click', () => {
        if (this.disposed) return;
        this.deploymentFailure = null;
        this.syncSelection(); // Re-check character/mode even for a dispatched click.
        const item = button.dataset.item;
        const permitted = slot.key === 'gadgets' ? this.options.gadgets : this.options.weapons;
        if (!permitted.includes(item)) return;
        if (slot.key !== 'gadgets') this[slot.field] = item;
        else if (this.selectedGadgets.includes(item)) this.selectedGadgets = this.selectedGadgets.filter(id => id !== item);
        else if (this.selectedGadgets.length < 2) this.selectedGadgets.push(item);
        else {
          this.feedback('Deux gadgets maximum. Retirez-en un avant d’en choisir un autre.');
          return;
        }
        this.syncSelection();
      });
    }
    this.listen(this.modeSelect, 'change', () => this.syncSelection());
    this.listen(document.getElementById('btn-confirm-loadout'), 'click', () => this.confirmLoadout());
  }

  confirmLoadout() {
    if (this.disposed || this.confirming || !this.screen || this.screen.classList.contains('hidden')) return false;
    this.deploymentFailure = null;
    const resolved = this.syncSelection();
    if (!resolved || resolved.fidelityMode === 'faithful' && !resolved.referenceKnown) return false;
    this.confirming = true;
    this.screen.classList.add('hidden');
    try {
      this.onConfirmLoadout({ ...resolved, plasma: this.selectedPlasma, gadgets: [...resolved.gadgets] });
    } catch (error) {
      this.confirming = false;
      this.screen.classList.remove('hidden');
      this.deploymentFailure = 'Déploiement interrompu. Votre équipement reste disponible pour un nouvel essai.';
      this.feedback(this.deploymentFailure);
      throw error;
    }
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    for (const remove of this.listeners) remove();
    this.listeners = [];
    this.selections.clear();
    this.summaryNode?.remove();
    this.referenceNode?.remove();
  }
}
